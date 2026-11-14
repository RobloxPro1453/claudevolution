// Built-in plugin: line-ending tolerant edits.
// A worktree checked out with CRLF (Windows, core.autocrlf) never matches the LF text a model sends, and the
// agent repeats the same edit until the loop guard stops it. If the exact text is not found and the file
// uses CRLF, match with CRLF and write the replacement with CRLF too. No effect on LF files.
export default {
    name: "crlf",
    beforeEdit(text, old_text, new_text) {
        if (text.includes("\r\n") && !old_text.includes("\r") && !text.includes(old_text)) {
            return { old_text: old_text.replace(/\n/g, "\r\n"), new_text: new_text.replace(/\r?\n/g, "\r\n") };
        }
        return { old_text, new_text };
    }
};
