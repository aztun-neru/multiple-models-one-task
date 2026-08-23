# Diagram prompt — for a local image model (SDXL / Flux / ComfyUI)

Generate a clean architecture diagram for the Mixture-of-Agents pattern.
Paste the prompt below into your text-to-image model (ComfyUI / SD WebUI / Flux).

## Prompt (English, tested style)

A dark-themed technical architecture diagram of a "Mixture-of-Agents" AI system.
Top: a single rounded rectangle labeled "TASK" with a downward arrow.
Below it three parallel rounded rectangles labeled "RESEARCH", "CODER", "CRITIC",
each connected by an arrow to a small glowing chip icon (three different accent colors:
blue, green, orange) representing three different models.
The three experts' arrows converge downward into a diamond labeled "JUDGE",
then a single arrow to a rounded rectangle labeled "SYNTHESIS",
then to a final rectangle labeled "ANSWER".
Flat vector infographic, dark navy background (#0a0e15), thin cyan and violet glow lines,
white sans-serif labels, minimal clean design, high contrast, no photorealism, no 3D, no text clutter.

## Negative prompt

blurry, photorealistic, 3D render, watermark, signature, extra text, jumbled letters, low quality

## Settings

- Steps: 28–35
- CFG: 5.5–7
- Resolution: 1344×768 (landscape)
- Sampler: DPM++ 2M Karras (or Euler a)

## Alternative — deterministic SVG (no image model needed)

If you want a pixel-perfect, editable diagram instead of a generated image, render it as
dark-themed SVG (see the `architecture-diagram` skill for the HTML/SVG approach). This is
preferred for docs/READMEs — labels stay legible and it scales.
