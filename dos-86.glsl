// eiDotter DOS-86: CRT shader for Ghostty.
// Set in the Ghostty config: custom-shader = /path/to/dos-86.glsl
//
// Port of dos-86.hlsl. The constants are written by build.mjs from
// tokens/dos-86.tokens.json; edit the tokens, not the numbers here.

// effect.scanline.*
const float SCANLINE_INTENSITY = 0.1;
const float SCANLINE_PITCH     = 3.0;

// effect.phosphor.*
const float GLOW_RADIUS        = 1.6;
const float BLOOM_RADIUS       = 4.5;
const float GLOW_INTENSITY     = 0.2;
const float BLOOM_INTENSITY    = 0.12;

// Aperture grille: faint vertical RGB stripes. 0 turns it off.
const float MASK_INTENSITY     = 0.06;

// effect.vignette.*
const float VIGNETTE_INTENSITY = 0.22;
const float VIGNETTE_SPREAD    = 0.2;

// effect.ghostty.pixelScale: device pixels per point (2 on Retina).
const float PIXEL_SCALE        = 2.0;

const float TWO_PI = 6.2831853;

vec3 ring(vec2 uv, vec2 texel, float radius)
{
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 8; i++)
    {
        float a = TWO_PI * (float(i) / 8.0);
        vec2 offset = vec2(cos(a), sin(a)) * radius * texel;
        sum += texture(iChannel0, uv + offset).rgb;
    }
    return sum / 8.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = fragCoord / iResolution.xy;
    vec2 texel = 1.0 / iResolution.xy;
    vec4 base = texture(iChannel0, uv);

    // Phosphor glow and halation: lit pixels bleed light into their neighbours.
    vec3 glow  = ring(uv, texel, GLOW_RADIUS * PIXEL_SCALE);
    vec3 bloom = ring(uv, texel, BLOOM_RADIUS * PIXEL_SCALE);
    vec3 color = base.rgb + glow * GLOW_INTENSITY + bloom * BLOOM_INTENSITY;

    // Scanlines: darken between raster rows.
    float row = fract(fragCoord.y / (SCANLINE_PITCH * PIXEL_SCALE));
    float dark = 0.5 - 0.5 * cos(TWO_PI * row);
    color *= 1.0 - SCANLINE_INTENSITY * dark;

    // Aperture grille.
    float stripe = mod(floor(fragCoord.x / PIXEL_SCALE), 3.0);
    vec3 mask = vec3(1.0);
    if (stripe < 0.5)       { mask = vec3(1.0, 1.0 - MASK_INTENSITY, 1.0 - MASK_INTENSITY); }
    else if (stripe < 1.5)  { mask = vec3(1.0 - MASK_INTENSITY, 1.0, 1.0 - MASK_INTENSITY); }
    else                    { mask = vec3(1.0 - MASK_INTENSITY, 1.0 - MASK_INTENSITY, 1.0); }
    color *= mask;

    // Vignette: the tube is dimmer toward the corners.
    float edge = smoothstep(0.5 - VIGNETTE_SPREAD, 0.75, length(uv - vec2(0.5)));
    color *= 1.0 - VIGNETTE_INTENSITY * edge;

    fragColor = vec4(clamp(color, 0.0, 1.0), base.a);
}
