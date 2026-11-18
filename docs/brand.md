# Jingle Studio Tools — Brand Guidelines

## 1. Logo Concept
- **Mark:** A bold lowercase **"j"** in Lime (`#B9D175`) on a Deep Plum (`#3F113D`) rounded-square tile (`512×512` grid, tile radius `112`).
- **Lens Dot:** The dot of the **"j"** is a small round glass lens—Cream (`#F6FBDD`) centre with a Lime (`#B9D175`) rim—representing looking closely and seeing clearly.
- **Flat Vector Rule:** Master logo files are flat vector with no gradients, blur, drop shadows, or thin details.

## 2. Colour Tokens
| Token | Hex | Usage |
| --- | --- | --- |
| `--plum` | `#3F113D` | Primary text, dark sections, primary buttons, tile fill |
| `--lime` | `#B9D175` | Accents, active indicators, glyph fill |
| `--mint` | `#DDEEC2` | Soft panels, hover fills, secondary surfaces |
| `--cream` | `#F6FBDD` | Page background, lens dot centre |
| `--plum-muted` | `#72536A` | Secondary text, inactive labels |

**Contrast Rules:**
- Text on Lime, Mint, and Cream is **always Plum** (`#3F113D`). Never place white text on Lime.
- Text on Plum is **Cream** (`#F6FBDD`) or **Lime** (`#B9D175`).

## 3. Clear Space & Minimum Sizes
- **Clear space:** Maintain clear space equal to the height of the lens dot on all four sides of the mark or lockup.
- **Minimum mark size:** `24px` (for `16px` and `32px` browser tabs, use the pixel-aligned simplified `favicon.svg` / `favicon-16x16.png` / `favicon-32x32.png`).
- **Minimum horizontal logo width:** `120px`.

## 4. Available Assets (`/public/brand/` & `/public/`)
- **Light backgrounds:** `/brand/logo-horizontal-plum.svg`, `/brand/logo-stacked-plum.svg`, `/brand/mark-mono-plum.svg`
- **Dark backgrounds:** `/brand/logo-horizontal-cream.svg`, `/brand/logo-stacked-cream.svg`, `/brand/mark-mono-cream.svg`
- **Raster exports:** `logo-horizontal.png` (`2000px`), `logo-email.png` (`600px`), `logo-square-512.png`, `logo-square-1024.png`, `social-avatar-800.png`, `google-oauth-logo-120.png`
- **Regenerating assets:** Run `pnpm brand:generate` (`scripts/generate-brand-assets.ts`).

## 5. Common Mistakes to Avoid
- Do not stretch, rotate, or add drop shadows/gradients to the master logo.
- Do not place the plum wordmark on dark plum backgrounds (use `logo-horizontal-cream.svg`).
- Do not shrink the full 512×512 mark down to `16px` without using the simplified pixel-grid favicon.
- Do not place white text on `#B9D175` Lime.
