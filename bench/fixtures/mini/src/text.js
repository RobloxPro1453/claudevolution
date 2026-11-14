// Turn a title into a URL slug.
export function slugify(title) {
    return String(title).trim().replace(/\s+/g, "-");
}
