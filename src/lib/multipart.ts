import Busboy from "busboy";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/request-security";

export class MultipartError extends Error {
  constructor(public status: 400 | 413, message: string) {
    super(message);
    this.name = "MultipartError";
  }
}

/** Parse multipart incrementally and stop accepting bytes at the upload limit. */
export function parseMultipart(request: NextRequest): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return Promise.reject(new MultipartError(400, "Expected multipart/form-data"));
  }
  if (!request.body) return Promise.reject(new MultipartError(400, "Empty request body"));

  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: { "content-type": contentType },
        limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 20, fieldSize: 4096, parts: 21 },
      });
    } catch {
      reject(new MultipartError(400, "Malformed multipart body"));
      return;
    }

    const result = new FormData();
    let fileSeen = false;
    let tooLarge = false;
    let failed = false;
    const fail = (error: MultipartError) => {
      if (failed) return;
      failed = true;
      reject(error);
    };

    parser.on("field", (name, value) => {
      if (name === "file") return fail(new MultipartError(400, "Invalid file field"));
      result.set(name, value);
    });
    parser.on("file", (name, stream, info) => {
      if (name !== "file") {
        stream.resume();
        return fail(new MultipartError(400, "Unexpected file field"));
      }
      fileSeen = true;
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("limit", () => {
        tooLarge = true;
        chunks.length = 0;
      });
      stream.on("end", () => {
        if (!tooLarge) {
          const bytes = Buffer.concat(chunks);
          result.set("file", new File([bytes], info.filename || "image", { type: info.mimeType }));
        }
      });
    });
    parser.on("filesLimit", () => fail(new MultipartError(400, "Only one file is allowed")));
    parser.on("fieldsLimit", () => fail(new MultipartError(400, "Too many fields")));
    parser.on("partsLimit", () => fail(new MultipartError(400, "Too many multipart parts")));
    parser.on("error", () => fail(new MultipartError(400, "Malformed multipart body")));
    parser.on("finish", () => {
      if (failed) return;
      if (tooLarge) return fail(new MultipartError(413, "File too large. Max 50MB."));
      if (!fileSeen) return fail(new MultipartError(400, "No file provided"));
      resolve(result);
    });

    Readable.fromWeb(request.body as never).on("error", () => fail(new MultipartError(400, "Invalid request body"))).pipe(parser);
  });
}
