# Photo Book Maker

Turn a pile of photos into a book. It runs entirely in the browser: photos are
never uploaded anywhere, and there is nothing to install or build.

## Use it

Open `index.html` in a browser (double-click it, or serve the folder with
`python3 -m http.server` and visit `http://localhost:8000`).

1. **Add photos.** Use the button, or drop files anywhere on the page. They are
   sorted by the date they were taken and laid out into pages automatically.
2. **Adjust.** Click a page to change its layout, the number of photos on it,
   or its caption. Click a photo to zoom it, drag it inside its frame, swap it
   with another, or replace it. Drag photos from the list onto frames.
3. **Preview.** Flip through the book as facing pages.
4. **Export PDF.** One PDF page per book page at the book's trim size, at
   300 dpi for printing or 150 dpi for sharing.

The book is saved in the browser (IndexedDB) as you work, so it is still there
after a reload. "Start a new book" under Book settings deletes it.

## What it does

- Trim sizes: 8 × 8 in, 11 × 8.5 in, 8 × 10 in, A4 portrait and landscape.
- 22 page layouts for one to six photos, plus text pages, a front cover in
  three styles, and a back cover.
- Automatic arrangement picks, for each page, the layout that crops its photos
  least, and narrows or shortens the block of frames when that keeps more of
  each photo. "Fill the page" on a page turns that off.
- Paper colour, lettering style, margins, page numbers.
- "Low res" warnings on photos that would print below about 130 dpi.
- Undo and redo for everything, including removing photos.

## Notes on printing

The PDF pages are exactly the trim size, with no bleed margin and no crop
marks. That suits home printing and print shops that trim to size; a service
that asks for bleed will need its own template. Photos are embedded as JPEG in
sRGB as the browser decodes them.

## Files

- `index.html` – the page.
- `styles.css` – all styling, light and dark.
- `app.js` – layout engine, editor, preview, and a small PDF writer. No
  dependencies.

HEIC photos open only in browsers that can decode them (Safari). JPEG, PNG and
WebP work everywhere.
