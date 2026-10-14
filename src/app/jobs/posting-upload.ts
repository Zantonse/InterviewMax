import {
  MAX_PAGE_HTML,
  MAX_SCREENSHOTS_BYTES,
  MAX_SCREENSHOT_TILES,
  postingFileKind,
  savedPageHtml,
  slimHtml,
} from "@/lib/jobs/posting-file";

// Runs in the browser: turns the files picked in the add-job form into the request the
// readJobPostingFile action reads, keeping it under the upload limit.

const TILE_WIDTH = 1400;
const TILE_HEIGHT = 1800;
// Neighbouring tiles share a strip so a line cut at the edge is whole in one of them.
const TILE_OVERLAP = 120;

export async function postingUpload(files: File[]): Promise<FormData> {
  const kinds = new Set(files.map((f) => postingFileKind(f.name)));
  if (files.length === 0 || kinds.has(null)) {
    throw new Error("Upload a PDF, a saved web page (.html or .mhtml) or a screenshot.");
  }
  const data = new FormData();
  if (kinds.size === 1 && kinds.has("image")) {
    data.append("kind", "image");
    const tiles = await screenshotTiles(files);
    if (tiles.reduce((sum, t) => sum + t.size, 0) > MAX_SCREENSHOTS_BYTES) {
      throw new Error("Those screenshots are too large together. Try fewer of them.");
    }
    for (const tile of tiles) data.append("image", tile, "screenshot.jpg");
    return data;
  }
  if (files.length > 1) {
    throw new Error("Upload one PDF or web page at a time. Several files work for screenshots.");
  }
  const [file] = files;
  if (kinds.has("pdf")) {
    data.append("kind", "pdf");
    data.append("file", file);
    return data;
  }
  if (file.size > 30 * 1024 * 1024) throw new Error("That page is too large to read.");
  const html = slimHtml(savedPageHtml(file.name, await file.text()));
  if (html.length > MAX_PAGE_HTML) {
    throw new Error(
      "That page is too large to read. Save it as a PDF or take screenshots instead.",
    );
  }
  data.append("kind", "page");
  data.append("html", html);
  return data;
}

// Scales each screenshot to a readable width and cuts long ones into overlapping tiles, as JPEG.
async function screenshotTiles(files: File[]): Promise<Blob[]> {
  const tiles: Blob[] = [];
  for (const file of files) {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(`${file.name} couldn't be opened as an image.`);
    }
    const scale = Math.min(1, TILE_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    for (let top = 0; top < height; top += TILE_HEIGHT - TILE_OVERLAP) {
      if (tiles.length >= MAX_SCREENSHOT_TILES) {
        bitmap.close();
        throw new Error(
          "That's more posting than I can read at once. Use fewer or shorter screenshots, or save the page as a PDF.",
        );
      }
      const h = Math.min(TILE_HEIGHT, height - top);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser couldn't prepare the screenshot.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, h);
      ctx.drawImage(bitmap, 0, top / scale, bitmap.width, h / scale, 0, 0, width, h);
      tiles.push(await toJpeg(canvas));
      if (top + h >= height) break;
    }
    bitmap.close();
  }
  return tiles;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Your browser couldn't prepare the screenshot.")),
      "image/jpeg",
      0.85,
    ),
  );
}
