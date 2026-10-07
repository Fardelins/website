# Avatar Crop Design

## Goal

Let a signed-in user frame and crop a profile image before it is uploaded to Fardelins.

## API contract

- Send `POST /v1/upload/avatar` as `multipart/form-data`.
- Use the multipart field name `image`, as documented in the Fardelins Bruno collection.
- Accept the upload response shape `{ message, code, data }`, where `data` is the Cloudinary avatar URL.
- Update the active user immediately from that URL, then refresh the full profile as a consistency check.

## User flow

1. The user chooses a JPEG, PNG, or WebP image from Profile settings.
2. A modal crop workspace opens without uploading anything.
3. The image is centered beneath a circular avatar guide inside a square crop viewport.
4. The user can drag to reposition and use a range control, mouse wheel, or touch gesture to zoom.
5. `Use photo` renders the selected square area to a canvas, exports a WebP file, and uploads it.
6. `Cancel` closes the crop workspace and preserves the existing avatar.

## Component boundary

Create a standalone `AvatarCropper` component under shared components. It owns image decoding, crop transforms, pointer interaction, canvas export, validation, and object URL cleanup. It accepts the selected `File` and emits either a cropped `File` or a cancel event. The Profile page owns modal visibility and calls `ProfileService.uploadAvatar` only after crop confirmation.

## Crop behavior

- Output aspect ratio: 1:1.
- Output size: 640 by 640 pixels.
- Output format: WebP at 90 percent quality.
- Minimum zoom always covers the crop area, so exported images never contain empty gaps.
- Default position is centered.
- Zoom is limited to a practical range from the cover scale to four times that scale.
- Dragging is clamped so the image cannot move beyond the crop bounds.
- Selecting another file replaces the pending crop.

## Responsive and accessibility behavior

- Desktop uses a centered modal; mobile uses a near-full-width bottom sheet above safe-area insets.
- The modal has dialog semantics, a labelled title, initial focus, Escape handling, and focus restoration through the existing file trigger.
- All actions remain keyboard accessible. Arrow keys nudge the image when the crop viewport is focused.
- Visible focus rings use dashboard tokens.
- Motion is subtle and disabled by reduced-motion preferences and the dashboard motion setting.
- Touch dragging uses pointer events. The zoom range remains the dependable mobile zoom control.
- Errors such as unsupported files or image decode failure are announced and do not discard the current avatar.

## Visual treatment

- Reuse dashboard surfaces, borders, typography, and primary purple actions.
- Dim the area outside the circular guide while keeping the full square crop visible.
- Show a compact live avatar preview beside the zoom control.
- Keep the interface playful through the preview and gentle entrance motion, without decorative clutter.

## Testing

- Verify the Bruno multipart field remains `image`.
- Verify the upload response URL updates the stored user avatar.
- Unit test crop geometry helpers for cover scale, clamping, and source rectangle calculation.
- Build the production application after integration.
