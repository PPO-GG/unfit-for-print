import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getDecorationImageUrl } from "~/utils/decorationImage";

describe("useR2", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NUXT_R2_ACCOUNT_ID = "test-account";
    process.env.NUXT_R2_ACCESS_KEY_ID = "test-key";
    process.env.NUXT_R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.NUXT_R2_BUCKET = "decoration-images";
  });

  it("constructs a client pointed at the R2 account endpoint", async () => {
    const { useR2 } = await import("~/server/utils/r2");

    const client = useR2();

    expect(client.config.endpoint).toBeDefined();
  });

  it("throws when credentials are missing", async () => {
    delete process.env.NUXT_R2_ACCOUNT_ID;
    const { useR2 } = await import("~/server/utils/r2");

    expect(() => useR2()).toThrow();
  });
});

describe("decoration image delivery", () => {
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
    vi.stubGlobal("getR2Bucket", () => "decoration-images");
    vi.stubGlobal("requireAdmin", requireAdmin);
    vi.stubGlobal("readMultipartFormData", readMultipart);
    vi.stubGlobal("getRouterParam", getRouterParam);
    vi.stubGlobal("setResponseHeader", setResponseHeader);
    vi.stubGlobal("sendStream", sendStream);
    vi.stubGlobal("crypto", { randomUUID: () => "uploaded-object" });

    requireAdmin.mockResolvedValue("admin-user");
    readMultipart.mockResolvedValue([
      {
        name: "file",
        data: imageData,
        filename: "crown.webp",
        type: "image/webp",
      },
    ]);
    getRouterParam.mockReturnValue("uploaded-object-crown.webp");
    r2Send.mockResolvedValue({});
    sendStream.mockReturnValue("streamed");

    uploadHandler = (
      await import("~/server/api/admin/decorations/upload.post")
    ).default as typeof uploadHandler;
    deleteHandler = (
      await import("~/server/api/admin/decorations/upload/[fileId].delete")
    ).default as typeof deleteHandler;
    imageHandler = (
      await import("~/server/api/decorations/images/[key].get")
    ).default as typeof imageHandler;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps an R2 object key to the same-origin image proxy", () => {
    expect(getDecorationImageUrl("uploaded-object-crown.webp")).toBe(
      "/api/decorations/images/uploaded-object-crown.webp",
    );
  });

  it("uploads the validated image to the configured bucket and returns its object key", async () => {
    await expect(uploadHandler(event)).resolves.toEqual({
      fileId: "uploaded-object-crown.webp",
      name: "crown.webp",
      size: 2,
      mimeType: "image/webp",
      imageFormat: "webp",
    });

    expect(requireAdmin).toHaveBeenCalledWith(event);
    const command = r2Send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: "decoration-images",
      Key: "uploaded-object-crown.webp",
      Body: imageData,
      ContentType: "image/webp",
    });
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
      Bucket: "decoration-images",
      Key: "uploaded-object-crown.webp",
    });
  });

  it("stops an unauthorized deletion before it reaches R2", async () => {
    requireAdmin.mockRejectedValueOnce(new Error("Forbidden"));

    await expect(deleteHandler(event)).rejects.toThrow("Forbidden");

    expect(r2Send).not.toHaveBeenCalled();
  });

  it("streams a decoration image from R2 with its content type", async () => {
    const body = Buffer.from("image");
    r2Send.mockResolvedValueOnce({ Body: body, ContentType: "image/webp" });

    await expect(imageHandler(event)).resolves.toBe("streamed");

    const command = r2Send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: "decoration-images",
      Key: "uploaded-object-crown.webp",
    });
    expect(setResponseHeader).toHaveBeenCalledWith(
      event,
      "content-type",
      "image/webp",
    );
    expect(sendStream).toHaveBeenCalledWith(event, body);
  });

  it("throws a 400 when the image route is requested without a key", async () => {
    getRouterParam.mockReturnValue(undefined);

    await expect(imageHandler(event)).rejects.toThrow("key is required");
    expect(r2Send).not.toHaveBeenCalled();
  });
});
