import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateUpload, MAX_MEDIA_SIZE } from "../upload-validation";

describe("content-validated uploads", () => {
  it.each(["png", "jpeg", "webp", "gif"] as const)("accepts a decodable %s and rejects a MIME spoof", async format => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).toFormat(format).toBuffer();
    const ext = format === "jpeg" ? "jpg" : format;
    expect(await validateUpload(new File([new Uint8Array(bytes)], `sample.${ext}`, { type: `image/${format}` }), "media")).not.toHaveProperty("error");
    expect(await validateUpload(new File([new Uint8Array(bytes)], "spoof.pdf", { type: "application/pdf" }), "attachment")).toHaveProperty("error");
  });
  it("rejects SVG even if disguised as an image", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>void 0</script></svg>';
    for (const [name, type] of [["active.svg", "image/svg+xml"], ["fake.png", "image/png"]]) {
      expect(await validateUpload(new File([svg], name, { type }), "media")).toHaveProperty("error");
    }
  });
  it("rejects malformed raster data, wrong extension, oversize and empty files", async () => {
    expect(await validateUpload(new File([Buffer.from("89504e470d0a1a0a", "hex")], "fake.png", { type: "image/png" }), "media")).toHaveProperty("error");
    expect(await validateUpload(new File(["abc"], "fake.jpg", { type: "image/png" }), "media")).toEqual({ error: "extension_mismatch" });
    expect(await validateUpload(new File([], "empty.png", { type: "image/png" }), "media")).toEqual({ error: "empty" });
    expect(await validateUpload(new File([new Uint8Array(MAX_MEDIA_SIZE + 1)], "large.png", { type: "image/png" }), "media")).toEqual({ error: "too_large" });
  });
  it("rejects images over the decoded pixel budget", async () => {
    const bytes = await sharp({ create: { width: 4100, height: 4100, channels: 3, background: "white" } }).png().toBuffer();
    expect(await validateUpload(new File([new Uint8Array(bytes)], "large.png", { type: "image/png" }), "media")).toHaveProperty("error");
  });
  it("accepts UTF-8 Arabic text with charset and rejects binary masquerading as text", async () => {
    expect(await validateUpload(new File(["بيانات مصطنعة"], "sample.txt", { type: "text/plain;charset=utf-8" }), "attachment")).not.toHaveProperty("error");
    expect(await validateUpload(new File(["a\0b"], "sample.txt", { type: "text/plain" }), "attachment")).toHaveProperty("error");
    expect(await validateUpload(new File([new Uint8Array([255, 254])], "sample.csv", { type: "text/csv" }), "attachment")).toHaveProperty("error");
  });
  it("checks PDF and legacy office container signatures", async () => {
    expect(await validateUpload(new File(["%PDF-1.4\nsynthetic\n%%EOF\n"], "sample.pdf", { type: "application/pdf" }), "attachment")).not.toHaveProperty("error");
    expect(await validateUpload(new File(["fake"], "sample.doc", { type: "application/msword" }), "attachment")).toHaveProperty("error");
    const compound = Buffer.alloc(512); Buffer.from("d0cf11e0a1b11ae1", "hex").copy(compound);
    expect(await validateUpload(new File([compound], "sample.doc", { type: "application/msword" }), "attachment")).not.toHaveProperty("error");
  });
  it("accepts empty standard ZIP and rejects ZIP header spoof / wrong Office contents", async () => {
    const zip = Buffer.alloc(22); zip.writeUInt32LE(0x06054b50);
    expect(await validateUpload(new File([zip], "sample.zip", { type: "application/zip" }), "attachment")).not.toHaveProperty("error");
    expect(await validateUpload(new File([zip], "sample.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), "attachment")).toHaveProperty("error");
    expect(await validateUpload(new File(["PK\x03\x04fake"], "sample.zip", { type: "application/zip" }), "attachment")).toHaveProperty("error");
  });
});
