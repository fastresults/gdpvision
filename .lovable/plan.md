# Refine evidence labels in the public brief

## Goal
Remove the boxed, button-like treatment around the evidence bullets shown beneath calculator inputs, while keeping each label usable for opening its evidence detail.

## Changes
- Restyle the evidence status control as quiet inline metadata: colored dot, label, and supporting grade or benchmark text without an enclosing border.
- Remove the inherited button surface and minimum-height treatment that makes the metadata look like a large outlined control.
- Keep a restrained hover and keyboard-focus cue through text emphasis or a short underline, without reintroducing a box.
- Preserve the existing green, amber, and neutral status colors, click behavior, accessibility label, and evidence modal.
- Check both standalone GDP/expenditure rows and the six framing-question rows so spacing remains consistent and duplicate grade labels still read cleanly.

## Validation
- Verify the affected section at desktop and mobile widths.
- Confirm each status remains clickable and keyboard accessible.
- Confirm the evidence modal still opens for record-backed, reference-based, and adjusted inputs.
- Run focused formatting, lint, type, and preview-build checks.
