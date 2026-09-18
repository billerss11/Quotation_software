# Word user manual maintenance

The app's **User Manual / 用户手册** entry provides English and Simplified Chinese Microsoft Word guides. Each contains all 31 reference sections and 24 real screenshots, native searchable text and tables, Word headings, image descriptions, and a linked contents page with page references. The desktop app opens a fresh temporary DOCX copy through the default associated application; the web app downloads the selected DOCX.

- UI: `src/features/user-manual/components/`
- Maintained text: `docs/user-manual.md` and `docs/user-manual.zh-CN.md`
- Screenshot inventory and focus rectangles: `src/features/user-manual/manualSections.ts`
- Figure captions and image descriptions: `src/shared/i18n/userManualMessages.ts` (document authoring data, not loaded by the app)
- Real screenshots: `docs/assets/user-manual/en-US/` and `docs/assets/user-manual/zh-CN/`
- Final files: `docs/user-guides/Quotation-Software-User-Guide-en-US.docx` and `docs/user-guides/Quotation-Software-User-Guide-zh-CN.docx`

## Rebuilding the Word guides

Use Node 24, `marked`, and `python-docx` from the document authoring environment. In Codex, resolve the bundled runtime and packages with `load_workspace_dependencies`; no app dependency installation is needed. Run these commands with those resolved paths:

```powershell
& $docNode scripts/export-user-manual-content.mjs $docNodeModules output/word-manual.local/content.json
& $docPython scripts/build-user-manual-docx.py output/word-manual.local/content.json
```

The builder preserves native paragraphs, numbered and bulleted lists, all nine reference tables, and the CSV examples. Word crops are metadata: original screenshot pixels remain embedded. Source pictures are not shipped separately in the app.

On Windows with Microsoft Word installed, refresh all page-reference fields and produce the native PDF for layout verification. Repeat for each locale, using a temporary PDF path:

```powershell
./scripts/render-user-manual-word.ps1 -DocumentPath docs/user-guides/Quotation-Software-User-Guide-en-US.docx -PdfPath output/word-manual.local/guide-en-US.pdf
& $docPython scripts/render-user-manual-pages.py docs/user-guides/Quotation-Software-User-Guide-en-US.docx output/word-manual.local/guide-en-US.pdf output/word-manual.local/render-en-US --renderer $documentSkillRenderer --poppler-bin $bundledPopplerBin
```

The renderer reuses the document skill's `render_docx.py` rasterization with the Microsoft Word-exported PDF; it does not invoke another office suite. Inspect every rendered page. Check contents links and page numbers, searchable text, all reference sections/tables, figures and captions, and both locales before replacing the distributed DOCX files. PDFs and page PNGs are QA intermediates, not user deliverables.

## Capture reference

Captured on 2026-09-18 using the in-app Browser and quotation `Q-SLB-INS-20260913-01`, the latest locally saved draft at capture time (2026-09-16). The draft was read from a copy of the desktop profile and imported through `quotationAgentV2` into the separate development browser. The original profile and quotation files were not edited.

All images are 1440 × 960 PNGs, captured with a 1440 × 960 CSS viewport and effective device pixel ratio 1. Check the actual page dimensions and PNG dimensions before capturing. Wait for fonts and finite UI transitions to finish. The Browser's default zoom can change these values; verify the resulting image instead of relying on the requested viewport alone. Browser CDP `Page.captureScreenshot` without a clip rectangle produced correctly scaled images for this capture.

The screenshots show the web UI. Instructions identify **Download / Save**, **Print / Export PDF**, and **Print GR / Export GR PDF** where web and desktop labels differ. Changing the app language does not change the quotation's document language.

## Refreshing screenshots

1. Use a separate browser profile or a copy of the desktop profile. Load the intended example and keep original quotation files unchanged.
2. Await `window.quotationAgentReady` and inspect `window.quotationAgentV2.getApiInfo()` before preparing a sample with the renderer API. Use ordinary UI actions to verify the walkthrough.
3. Capture each step in both app languages, using the same filename in each locale folder. Save to a temporary folder while working, then copy the finished set into `docs/assets/user-manual/`. The temporary fourth item is **Site inspection**, quantity **2 DAY**, unit cost **250 USD**; its child example is **Inspector**.
4. Update the focus rectangles from visible element bounds divided by viewport dimensions, expressed as percentages. `focus` is English and `focusZh` is Chinese. Keep each rectangle within the image.
5. Review the related Word image crops in `scripts/build-user-manual-docx.py`, rebuild both guides, and repeat document QA. Verify both app buttons and return to the editor. Run `npm run typecheck` and `npm run build` so bundled offline files are verified.

Vite uses `docs/user-guides/` as its public directory and copies the DOCX files into the root of `dist/`. Browser download paths use `import.meta.env.BASE_URL` for subpath hosting. The desktop IPC handler reads the guides from `docs/user-guides/` during development and from `dist/` when packaged, validates the locale, selects a fixed bundled filename, and copies it out of ASAR before opening it. Each open uses a fresh temporary directory so reopening the guide cannot overwrite a previously edited copy.
