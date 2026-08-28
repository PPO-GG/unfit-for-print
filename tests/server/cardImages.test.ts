import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getCardImageUrl } from "~/utils/cardImage";

describe("card image delivery", () => {
  const r2Send = vi.fn();
  const requireAdmin = vi.fn();
  const readMultipart = vi.fn();
  const getRouterParam = vi.fn();
  const setResponseHeader = vi.fn();
  const sendStream = vi.fn();

  const event = {} as any;
  const imageData = Buffer.from([0x52, 0x32]);

  let uploadHandler: (event: unknown) => Promise<unknown>;
  let deleteHandler: (event: unknown) => Promise<unknown>;
  let imageHandler: (event: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.stubGlobal("useR2", () => ({ send: r2Send }));
    vi.stubGlobal("getR2Bucket", () => "card-images");
    vi.stubGlobal("requireAdmin", requireAdmin);
    vi.stubGlobal("readMultipartFormData", readMultipart);
    vi.stubGlobal("getRouterParam", getRouterParam);
    vi.stubGlobal("setResponseHeader", setResponseHeader);
    vi.stubGlobal("sendStream", sendStream);
    vi.stubGlobal("crypto", { randomUUID: () => "uploaded-card" });

    requireAdmin.mockResolvedValue("admin-user");
    readMultipart.mockResolvedValue([
      { name: "file", data: imageData, filename: "doge.webp", type: "image/webp" },
    ]);
    getRouterParam.mockReturnValue("uploaded-card-doge.webp");
    r2Send.mockResolvedValue({});
    sendStream.mockReturnValue("streamed");

    uploadHandler = (
      await import("~/server/api/admin/cards/images/upload.post")
    ).default as typeof uploadHandler;
    deleteHandler = (
      await import("~/server/api/admin/cards/images/[key].delete")
    ).default as typeof deleteHandler;
    imageHandler = (
      await import("~/server/api/cards/images/[key].get")
    ).default as typeof imageHandler;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps an R2 object key to the same-origin card image proxy", () => {
    expect(getCardImageUrl("uploaded-card-doge.webp")).toBe(
      "/api/cards/images/uploaded-card-doge.webp",
    );
  });

  it("uploads the validated image to the configured bucket and returns its object key", async () => {
    await expect(uploadHandler(event)).resolves.toEqual({
      fileId: "uploaded-card-doge.webp",
      name: "doge.webp",
      size: 2,
      mimeType: "image/webp",
      imageFormat: "webp",
    });

    expect(requireAdmin).toHaveBeenCalledWith(event);
    const command = r2Send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: "card-images",
      Key: "uploaded-card-doge.webp",
      Body: imageData,
      ContentType: "image/webp",
    });
  });

  it("rejects a file type outside png/webp/jpeg", async () => {
    readMultipart.mockResolvedValueOnce([
      { name: "file", data: imageData, filename: "clip.gif", type: "image/gif" },
    ]);

    await expect(uploadHandler(event)).rejects.toThrow("Invalid file type");
    expect(r2Send).not.toHaveBeenCalled();
  });

  it("stops an unauthorized upload before reading or storing its file", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"));

    await expect(uploadHandler(event)).rejects.toThrow("Forbidden");

    expect(readMultipart).not.toHaveBeenCalled();
    expect(r2Send).not.toHaveBeenCalled();
  });

  it("deletes the requested object key from the configured bucket", async () => {
    await expect(deleteHandler(event)).resolves.toEqual({ success: true });

    expect(requireAdmin).toHaveBeenCalledWith(event);
    const command = r2Send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: "card-images",
      Key: "uploaded-card-doge.webp",
    });
  });

  it("streams a card image from R2 with its content type", async () => {
    const body = Buffer.from("image");
    r2Send.mockResolvedValueOnce({ Body: body, ContentType: "image/webp" });

    await expect(imageHandler(event)).resolves.toBe("streamed");

    const command = r2Send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: "card-images",
      Key: "uploaded-card-doge.webp",
    });
    expect(setResponseHeader).toHaveBeenCalledWith(event, "content-type", "image/webp");
    expect(sendStream).toHaveBeenCalledWith(event, body);
  });

  it("throws a 400 when the image route is requested without a key", async () => {
    getRouterParam.mockReturnValue(undefined);

    await expect(imageHandler(event)).rejects.toThrow("key is required");
    expect(r2Send).not.toHaveBeenCalled();
  });

  it("rejects a key containing path-traversal sequences", async () => {
    getRouterParam.mockReturnValue("../../etc/passwd");

    await expect(imageHandler(event)).rejects.toThrow("Invalid key");
    expect(r2Send).not.toHaveBeenCalled();
  });

  it("rejects a key with a leading slash", async () => {
    getRouterParam.mockReturnValue("/etc/passwd");

    await expect(imageHandler(event)).rejects.toThrow("Invalid key");
    expect(r2Send).not.toHaveBeenCalled();
  });

  it("maps an R2 NoSuchKey error to a 404 response", async () => {
    r2Send.mockRejectedValueOnce({ name: "NoSuchKey" });

    await expect(imageHandler(event)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("maps an R2 404 httpStatusCode error to a 404 response", async () => {
    r2Send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

    await expect(imageHandler(event)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("stops an unauthorized delete before calling R2", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"));

    await expect(deleteHandler(event)).rejects.toThrow("Forbidden");
    expect(r2Send).not.toHaveBeenCalled();
  });

  it("rejects files larger than 5MB", async () => {
    const bigData = Buffer.alloc(5 * 1024 * 1024 + 1);
    readMultipart.mockResolvedValueOnce([
      { name: "file", data: bigData, filename: "huge.webp", type: "image/webp" },
    ]);

    await expect(uploadHandler(event)).rejects.toThrow("File too large");
    expect(r2Send).not.toHaveBeenCalled();
  });
});
