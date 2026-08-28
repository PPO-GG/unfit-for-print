import type { CardAttachmentConfig } from "~/types/card";

export interface CardFormState {
  type: "white" | "black";
  pack?: string;
  pick?: number;
  mode: "text" | "image";
  text: string;
  imageFileId: string | null;
  imageFormat: string | null;
  attachment: CardAttachmentConfig;
}

/**
 * Builds the request body for /api/admin/cards/create and /edit. `mode`
 * decides which of text/image wins — a card can't have both, so switching
 * modes in the editor must null out the other side rather than leave stale
 * data on the row.
 */
export function buildCardPayload(form: CardFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = { type: form.type };
  if (form.pack !== undefined) payload.pack = form.pack;
  if (form.type === "black" && form.pick) payload.pick = form.pick;

  if (form.mode === "image") {
    payload.text = null;
    payload.imageFileId = form.imageFileId;
    payload.imageFormat = form.imageFormat;
    payload.attachment = form.attachment;
  } else {
    payload.text = form.text.trim();
    payload.imageFileId = null;
    payload.imageFormat = null;
    payload.attachment = null;
  }
  return payload;
}
