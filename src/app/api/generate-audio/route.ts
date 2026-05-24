import { NextRequest, NextResponse } from 'next/server';
import { EdgeTTS } from '@/utils/edge-tts';
import { z } from 'zod';

// --- CONSTANTS ---
const SILENCE_FRAME_BASE64 = "//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
const SILENCE_FRAME_BUFFER = Buffer.from(SILENCE_FRAME_BASE64, 'base64');
const SILENCE_DURATION_SEC = 0.1;
const TTS_BATCH_SIZE = 5;
const MAX_SEGMENTS = 50;

// File Logger
function log(message: string) {
    console.log(message);
}



interface AudioSegment {
    idx: number;
    text?: string;
    speaker?: string;
    speakers?: Record<string, { gender?: 'male' | 'female' }>;
    pause?: number;
}

type SpeakersMap = Record<string, { gender?: 'male' | 'female' }>;

// Voice mapping table: [language][gender] -> voice name
const VOICE_MAP: Record<string, Record<string, string>> = {
    English: {
        male: 'en-US-ChristopherNeural',
        female: 'en-US-AriaNeural',
    },
    Vietnamese: {
        male: 'vi-VN-NamMinhNeural',
        female: 'vi-VN-HoaiMyNeural',
    },
};

const LANG_CODE_MAP: Record<string, string> = {
    Vietnamese: 'vi-VN',
    English: 'en-US',
};

const GOOGLE_LANG_MAP: Record<string, string> = {
    Vietnamese: 'vi',
    English: 'en',
};

function resolveVoice(language: string, gender: string): string {
    return VOICE_MAP[language]?.[gender] || VOICE_MAP.English.female;
}

async function generateSegment(
    segment: AudioSegment,
    language: string,
    _accentMode: string,
    speakers: SpeakersMap
): Promise<Buffer> {
    const spk = segment.speaker || 'A';
    const gender = speakers[spk]?.gender || 'female';
    const voice = resolveVoice(language, gender);
    const langCode = LANG_CODE_MAP[language] || 'en-US';

    try {
        console.log(`[TTS] Trying EdgeTTS for: ${segment.text!.substring(0, 10)}...`);
        const tts = new EdgeTTS({
            voice,
            lang: langCode,
            outputFormat: 'audio-24khz-96kbitrate-mono-mp3'
        });
        const result = await tts.call(segment.text!);
        return result.data;
    } catch (e: unknown) {
        const edgeErr = e instanceof Error ? e : new Error(String(e));
        console.error(`EdgeTTS failed for ${voice}, trying Google Fallback. Error: ${edgeErr.message}`);

        // Fallback to Google Translate TTS (Free)
        try {
            console.log(`[TTS] Trying GoogleFallback for: ${segment.text!.substring(0, 10)}...`);
            const googleTTS = require('google-tts-api');
            const url = googleTTS.getAudioUrl(segment.text!, {
                lang: GOOGLE_LANG_MAP[language] || 'en',
                slow: false,
                host: 'https://translate.google.com',
            });

            // Fetch the audio URL and convert to Buffer
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Google TTS Fetch failed: ${res.statusText}`);
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);

        } catch (fallbackError: unknown) {
            const fbErr = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
            console.error("Google Fallback also failed", fbErr);
            throw edgeErr;
        }
    }
}

// Batch processing helper
async function processInBatches<T, R>(items: T[], batchSize: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map((item, idx) => fn(item, i + idx)));
        results.push(...batchResults);
    }
    return results;
}

const AudioRequestSchema = z.object({
    segments: z.array(z.object({
        idx: z.number(),
        text: z.string().optional(),
        speaker: z.string().optional(),
        speakers: z.record(z.string(), z.any()).optional(),
        pause: z.number().optional(),
    })).min(1).max(MAX_SEGMENTS),
    speakers: z.record(z.string(), z.object({
        gender: z.enum(['male', 'female']).optional(),
    })).optional().default({}),
    language: z.enum(['Vietnamese', 'English']).default('Vietnamese'),
    accentMode: z.string().default('north'),
});

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json();
        const parsed = AudioRequestSchema.safeParse(rawBody);

        if (!parsed.success) {
            return NextResponse.json({
                error: 'Invalid request',
                details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
            }, { status: 400 });
        }

        const { segments, speakers, language, accentMode } = parsed.data;
        log(`Req: Lang=${language}, Segs=${segments?.length}`);



        // Processing Function
        const processItem = async (segment: AudioSegment, index: number) => {
            // Case 1: Silence
            if (segment.pause) {
                const pauseSec = segment.pause / 1000;
                // Repeat silence frame to match duration roughly
                const count = Math.ceil(pauseSec / SILENCE_DURATION_SEC);
                // Concat silence frames
                const silenceChunk = Buffer.concat(Array(count).fill(SILENCE_FRAME_BUFFER));
                // Client handles actual duration via audio element metadata
                return { buffer: silenceChunk, duration: pauseSec };
            }

            // Case 2: TTS
            if (segment.text && segment.speaker) {
                try {
                    const buf = await generateSegment(segment, language, accentMode, speakers);
                    if (buf && buf.length > 0) {
                        return { buffer: buf, duration: 0 };
                    }
                } catch (e) {
                    console.error(`Gen error seg ${index}`, e);
                }
            }

            // Fallback
            return { buffer: Buffer.alloc(0), duration: 0 };
        };

        // Run in batches of 5 (Process all requested segments)
        const results = await processInBatches(segments, TTS_BATCH_SIZE, processItem);

        // Return individual segments for client-side mapping
        const responseSegments = results.map((r, i) => ({
            idx: segments[i].idx,
            audioContent: r.buffer.toString('base64'),
            duration: r.duration
        }));

        return NextResponse.json({
            segments: responseSegments
        });

    } catch (error: unknown) {
        console.error('API Error:', error);
        const errMsg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: 'Generation failed', details: errMsg }, { status: 500 });
    }
}
