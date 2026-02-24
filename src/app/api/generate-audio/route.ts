import { NextRequest, NextResponse } from 'next/server';
import { EdgeTTS } from '@/utils/edge-tts';

// --- CONSTANTS ---
// ~100ms of Silence (MPEG 1 Layer III, 44.1kHz, 64kbps) - valid MP3 frame
const SILENCE_FRAME_BASE64 = "//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
const SILENCE_FRAME_BUFFER = Buffer.from(SILENCE_FRAME_BASE64, 'base64');
const SILENCE_DURATION_SEC = 0.1; // Approx duration of one frame above

// File Logger
function log(message: string) {
    console.log(message);
}



async function generateSegment(
    segment: any,
    language: string,
    accentMode: string,
    speakers: any
): Promise<Buffer> {
    const spk = segment.speaker;
    const gender = speakers[spk]?.gender || 'female';

    // Map Voices
    let voice = 'en-US-AriaNeural'; // Default
    if (language === 'English') {
        voice = gender === 'male' ? 'en-US-ChristopherNeural' : 'en-US-AriaNeural';
    } else if (language === 'Vietnamese') {
        // North: NamMinh (Male), HoaiMy (Female)
        if (accentMode === 'south') {
            // SOUTH MODE:
            // Female -> HoaiMy (South) - Perfect
            // Male -> NamMinh (North) - Fallback (No South Male available)
            voice = gender === 'male' ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
        } else {
            // NORTH MODE:
            // Male -> NamMinh (North) - Perfect
            // Female -> HoaiMy (South) - Fallback (No North Female available? Check logic)
            // Actually currently HoaiMy is the only female. 
            voice = gender === 'male' ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural';
        }
    }

    try {
        console.log(`[TTS] Trying EdgeTTS for: ${segment.text.substring(0, 10)}...`);
        const tts = new EdgeTTS({
            voice,
            lang: language === 'Vietnamese' ? 'vi-VN' : 'en-US',
            outputFormat: 'audio-24khz-96kbitrate-mono-mp3'
        });
        const result = await tts.call(segment.text);
        return result.data;
    } catch (e: any) {
        console.error(`EdgeTTS failed for ${voice}, trying Google Fallback. Error: ${e.message}`);

        // Fallback to Google Translate TTS (Free)
        try {
            console.log(`[TTS] Trying GoogleFallback for: ${segment.text.substring(0, 10)}...`);
            // Import dynamically or assume it's available since verified
            const googleTTS = require('google-tts-api');
            const url = googleTTS.getAudioUrl(segment.text, {
                lang: language === 'Vietnamese' ? 'vi' : 'en',
                slow: false,
                host: 'https://translate.google.com',
            });

            // Fetch the audio URL and convert to Buffer
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Google TTS Fetch failed: ${res.statusText}`);
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);

        } catch (fallbackError: any) {
            console.error("Google Fallback also failed", fallbackError.message);
            throw e; // Throw original error or fallback error? Throwing E is better to know root cause.
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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { segments, speakers, language, accentMode = 'north' } = body;
        log(`Req: Lang=${language}, Segs=${segments?.length}`);

        if (!segments || !Array.isArray(segments)) {
            return NextResponse.json({ error: 'Invalid segments' }, { status: 400 });
        }



        // Processing Function
        const processItem = async (segment: any, index: number) => {
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
        const results = await processInBatches(segments, 5, processItem);

        // Return individual segments for client-side mapping
        const responseSegments = results.map((r, i) => ({
            idx: segments[i].idx,
            audioContent: r.buffer.toString('base64'),
            duration: r.duration
        }));

        return NextResponse.json({
            segments: responseSegments
        });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Generation failed', details: error.message }, { status: 500 });
    }
}
