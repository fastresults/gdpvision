## Plan: Make Opposition image drops visibly acknowledge and track uploads

### What the logs show
- Image upload is reaching the backend successfully: signed upload URL is created, storage `PUT` succeeds, intake row is created, and analysis begins/finishes.
- The actual UX gap is frontend feedback: dropping images does not give the user a clear enough visual confirmation that files were accepted and are being processed.

### Changes to make
1. **Strengthen drop-state feedback**
   - When files are dragged over the dropzone, make the zone visibly change state.
   - When files are dropped, immediately show a clear “Received X file(s)” message before upload begins.

2. **Add a visible upload queue**
   - Show each dropped file with filename, detected type, and current stage:
     - Received
     - Uploading
     - Registering
     - Analyzing
     - Complete
     - Failed
   - Keep completed rows visible long enough that the user sees the result instead of the status disappearing instantly.

3. **Use toast feedback for key moments**
   - On drop: “Image received” / “Files received”.
   - On successful ingest: “Opposition intake created”.
   - On failure: show the actual upload/register/analyze error.

4. **Harden file acceptance UX**
   - Validate dropped files against the supported types before upload.
   - Surface an immediate message for unsupported files instead of silently doing nothing.
   - Align the file input accept list with the copy if videos are intended; otherwise keep copy limited to images/PDF/text.

5. **Refresh the recent intakes list earlier and more reliably**
   - Invalidate/refetch the `opposition-items` query immediately after each intake row is created, not only after all analysis completes.
   - This lets the row appear as `analyzing` right away.

6. **Verify after implementation**
   - Drop an image in the live preview.
   - Confirm the visible queue appears immediately.
   - Confirm the Recent Intakes list updates with the uploaded screenshot.
   - Confirm success/error feedback is visible without relying on network logs.