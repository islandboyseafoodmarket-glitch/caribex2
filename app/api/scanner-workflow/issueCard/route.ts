// The installed scanner APK calls this legacy endpoint name. Reuse the same
// authenticated handler so uploads, notes, and problem flags follow one path.
export { POST } from "../issue/route";
