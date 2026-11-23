// eiDotter DOS-86: CRT pixel shader for Windows Terminal.
// Set as "experimental.pixelShaderPath" on a profile.
//
// The knobs mirror eidotter's effect tokens (src/tokens/effects-params.tokens.json).
// Values are tuned down from the web defaults: this runs over text you read
// all day, not over a hero section.

Texture2D shaderTexture;
SamplerState samplerState;

cbuffer PixelShaderSettings
{
    float  Time;
    float  Scale;
    float2 Resolution;
    float4 Background;
};

// effect.scanline.*
static const float SCANLINE_INTENSITY = 0.1;  // token default 0.6
static const float SCANLINE_PITCH     = 3.0;   // px at 100% scale; token default 4px

// effect.phosphor.*
static const float GLOW_RADIUS        = 1.6;   // px, tight glow around lit pixels
static const float BLOOM_RADIUS       = 4.5;   // px, soft halation
static const float GLOW_INTENSITY     = 0.2;
static const float BLOOM_INTENSITY    = 0.12;  // token default 0.5

// Aperture grille: faint vertical RGB stripes. 0 turns it off.
static const float MASK_INTENSITY     = 0.06;

// effect.vignette.*
static const float VIGNETTE_INTENSITY = 0.22;
static const float VIGNETTE_SPREAD    = 0.2;

static const float TWO_PI = 6.2831853;

float3 ring(float2 uv, float2 texel, float radius)
{
    float3 sum = float3(0.0, 0.0, 0.0);
    for (int i = 0; i < 8; i++)
    {
        float a = TWO_PI * (float(i) / 8.0);
        float2 offset = float2(cos(a), sin(a)) * radius * texel;
        sum += shaderTexture.Sample(samplerState, uv + offset).rgb;
    }
    return sum / 8.0;
}

float4 main(float4 pos : SV_POSITION, float2 tex : TEXCOORD) : SV_TARGET
{
    float2 texel = Scale / Resolution;
    float4 base = shaderTexture.Sample(samplerState, tex);

    // Phosphor glow and halation: lit pixels bleed light into their neighbours.
    float3 glow  = ring(tex, texel, GLOW_RADIUS);
    float3 bloom = ring(tex, texel, BLOOM_RADIUS);
    float3 color = base.rgb + glow * GLOW_INTENSITY + bloom * BLOOM_INTENSITY;

    // Scanlines: darken between raster rows.
    float row = frac(pos.y / (SCANLINE_PITCH * Scale));
    float dark = 0.5 - 0.5 * cos(TWO_PI * row);
    color *= 1.0 - SCANLINE_INTENSITY * dark;

    // Aperture grille.
    float stripe = fmod(floor(pos.x), 3.0);
    float3 mask = float3(1.0, 1.0, 1.0);
    if (stripe < 0.5)       { mask = float3(1.0, 1.0 - MASK_INTENSITY, 1.0 - MASK_INTENSITY); }
    else if (stripe < 1.5)  { mask = float3(1.0 - MASK_INTENSITY, 1.0, 1.0 - MASK_INTENSITY); }
    else                    { mask = float3(1.0 - MASK_INTENSITY, 1.0 - MASK_INTENSITY, 1.0); }
    color *= mask;

    // Vignette: the tube is dimmer toward the corners.
    float2 d = tex - float2(0.5, 0.5);
    float edge = smoothstep(0.5 - VIGNETTE_SPREAD, 0.75, length(d));
    color *= 1.0 - VIGNETTE_INTENSITY * edge;

    return float4(saturate(color), base.a);
}
