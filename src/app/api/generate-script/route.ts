import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { generateContentWithRetry } from '@/utils/gemini';

export async function POST(req: NextRequest) {
  try {
    const { input, language, count, apiKey, model: modelName, accentMode = 'all-standard', mode = 'roleplay' } = await req.json();

    console.log('[API] Request received:', { input, language, count, modelName });

    const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (!finalApiKey || finalApiKey === 'YOUR_GEMINI_API_KEY') {
      return NextResponse.json({
        error: 'Gemini API Key is currently missing.',
        details: 'Please enter a valid API Key in the settings panel.'
      }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(finalApiKey);
    const selectedModel = modelName || 'gemini-2.5-flash';

    const schema: any = {
      description: "Conversation script with speaker info",
      type: SchemaType.OBJECT,
      properties: {
        speakers: {
          type: SchemaType.OBJECT,
          properties: {
            A: {
              type: SchemaType.OBJECT,
              properties: {
                gender: { type: SchemaType.STRING, enum: ["male", "female"], description: "Gender of speaker A" }
              },
              required: ["gender"]
            },
            B: {
              type: SchemaType.OBJECT,
              properties: {
                gender: { type: SchemaType.STRING, enum: ["male", "female"], description: "Gender of speaker B" }
              },
              nullable: true
            }
          },
          required: ["A"]
        },
        script: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              speaker: { type: SchemaType.STRING, description: "Speaker identifier (A or B)" },
              text: { type: SchemaType.STRING, description: "The spoken text in target language" },
              translation: { type: SchemaType.STRING, description: "Korean translation" },

              word_analysis: {
                type: SchemaType.ARRAY,
                description: "List of meaningful chunks or phrases (Chunks First!) for every part of the sentence",
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    word: { type: SchemaType.STRING, description: "The meaningful chunk or phrase being analyzed" },
                    meaning: { type: SchemaType.STRING, description: "Korean meaning IN FORMAT: [Grammatical Role] Meaning (e.g. [동사구] 가져다주다)" },
                    grammar: { type: SchemaType.STRING, description: "STRICTLY KOREAN ONLY - Deep Scan Analysis (Etymology/Hanja/Imagery) in Korean" }
                  },
                  required: ["word", "meaning", "grammar"]
                }
              },
            },
            required: ["speaker", "text", "translation", "word_analysis"],
          }
        }
      },
      required: ["speakers", "script"]
    };

    const model = genAI.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 1.2, // High creativity for diverse native expressions
      },
    });

    const isInputEmpty = !input || input.trim() === '';

    // ------------------------------------------------------------------
    // DIVERSE TOPIC GENERATION (Native Contexts)
    // ------------------------------------------------------------------
    // ------------------------------------------------------------------
    // DIVERSE TOPIC GENERATION (Dynamic Native Contexts)
    // ------------------------------------------------------------------
    // Only used when input is empty. Instructs the AI to generate its own unique scenario.
    const dynamicTopicInstruction = isInputEmpty
      ? "Generate a completely random, creative, and highly specific native-level scenario or conflict. Avoid cliches like ordering food or asking for directions. Think of intense, funny, or awkward real-life situations (e.g., a misunderstanding about a secret, a negotiation over a strange item, an unexpected encounter in a weird place)."
      : input;

    const promptInput = dynamicTopicInstruction;


    const isAnalysisMode = count === 0 && mode === 'analysis';
    const isMonologueMode = count === 0 && mode === 'roleplay'; // New Mode

    let baseInstruction = '';

    if (isAnalysisMode) {
      baseInstruction = `
          VERBATIM ANALYSIS MODE ACTIVATED:
          - DO NOT generate a roleplay or conversation.
          - DO NOT change or "fix" the input text. Use the user's "Input" EXACTLY as it is.
          - SEGMENTATION STRATEGY:
            1. Split the input text into INDIVIDUAL sentences for granular analysis.
          - Assign all segments to Speaker "A".
          - Provide ALL descriptions, including translations and word analysis, in Korean ONLY.
          - Provide 초정밀 분석 (Deep Scan) for each segment according to the rules and examples.
        `;
    } else if (isMonologueMode) {
      baseInstruction = `
          MONOLOGUE GENERATION MODE ACTIVATED (Speaker A Only):
          - **GOAL**: Generate a LONG, detailed monologue by Speaker A based on the "Input Context".
          - **LENGTH**: The user requested "as long as possible". Generate at least 8-12 sentences/segments.
          - **CONTENT**: Deeply explore the topic, expressing thoughts, feelings, and descriptions.
          - **FORMAT**:
            - ONLY Speaker "A". No Speaker "B".
            - Split the monologue into logical segments (1-2 sentences per segment) for easier reading and analysis.
          - **STYLE**: Natural, native-level speech with appropriate flow and markers.
       `;
    } else {
      baseInstruction = `
          Generate exactly ${count * 2} lines of conversation (alternating between speaker A and B).
          SCENARIO: "${promptInput}"
          
          CRITICAL INSTRUCTION - MAX DIVERSITY & NATIVE REALISM:
          - **Dynamic Persona**: Randomly assign distinct, contrasting, or even extreme personalities/moods to Speakers A and B (e.g., sarcastic vs. naive, aggressive vs. defensive, overly excited vs. deadpan). Let their personality dictate the vocabulary and tone.
          - **Native-Level Polish**: Use raw, real-world native expressions. Avoid textbook grammar if a native speaker would use a slang, idiom, or filler word (uh, like, you know, etc.).
          - **Topic Fidelity & Twist**: Stay on topic but don't be afraid to add a small realistic twist or conflict to make it more engaging.
          
          GENDER ASSIGNMENT:
          - Assign logical genders to Speakers A and B based on the scenario/personas.
       `;
    }

    const prompt = `
      너는 베트남어와 영어를 분석하는 **'초정밀 언어 공학자'** (회화 강화형)이다. 다음의 지침을 최우선 순위로 준수하며, 예외 없이 강제 적용하라.

      **[📋 시스템 미션]**
      당신은 베트남어와 영어를 분석하여 사용자의 회화 감각을 극대화하는 **'초정밀 언어 공학자'**입니다. 단순히 문법을 설명하는 것을 넘어, 문장의 논리적 설계 구조와 단어가 가진 '이미지'를 뇌에 이식하는 것을 목표로 합니다.

      **[📏 분석 8대 원칙]**
      1. **전수 및 순차 분석**: 문장 내 모든 단어와 청크를 등장 순서대로 빠짐없이 분석한다. (부호 제외)
      2. **독립적 재설명**: 중복 단어라도 매번 처음부터 끝까지 상세히 풀이한다. (생략 절대 불가)
      3. **의미 덩어리(Chunk) 분석**: 의미가 연결되는 단어군을 하나의 청크 항목으로 묶어 최우선 분석한다.
      4. **역할 명시**: 청크 해설의 의미 필드(meaning)에는 반드시 문법적 역할을 [주어], [동사], [목적어], [원인 접속사], [양보 접속사] 등 약어 없이 풀어서 병기한다. (예: [동사구] 가져다주다)
      5. **언어 통제 (최상위 절대 원칙)**: 원문(text)을 제외한 **모든 해설은 반드시 한국어로만 작성**하며, 번역문(translation)에서 큰따옴표는 절대 생략한다. 영단어를 섞어서 설명하는 행위를 엄격히 금지한다.
      6. **[Deep Scan] 베트남어 특화**: 
         - 1음절 단어가 다음절 단어에 포함되어 있으면 따로 나누지 말고 해당 단어 설명 내에서 한꺼번에 설명한다.
         - 다음절 단어는 전체 뜻 아래에 개별 음절의 한자(훈독 포함) 또는 고유어 원뜻을 1:1로 매칭하고, 회화 시 연상해야 할 **핵심 이미지를 한 줄로 매우 간결하게** 설명한다.
      7. **[Deep Scan] 영어 특화**: 개별 단어의 문맥적 뜻과 더불어, 해당 단어가 머릿속에 그리는 **핵심 이미지를 모바일 가독성을 위해 본질만 짧게** 설명한다.

      **[📱 출력 포맷 가이드]**
      - 번역(\`translation\`): 큰따옴표 없이 한국어로만 작성한다.
      - 의미(\`meaning\`): **[문법 역할] 청크 전체 의미** (예: [원인 접속사] ~하기 때문에)
      - 해설(\`grammar\`): **[단어 / 뜻 / 어원 및 이미지 상세 해설]** (개행 문자 \\n으로 연결)

      **중요 Rules (절대 준수):**
      1. **헤더 삭제**: '청크 제목 [역할]: 의미' 와 같은 첫 줄(중복 정보)을 절대 쓰지 말고, 즉시 첫 번째 대괄호 분석(\`[ ]\`)부터 시작한다.
      2. **강제 줄바꿈**: 모든 대괄호([ ]) 항목 사이에는 반드시 개행 문자 \`\\n\`을 삽입해야 한다. 모든 분석 항목이 화면에서 세로로 한 줄씩 배치되도록 하는 것이 핵심이다.
      3. **가독성(형식)**: 한 줄에 두 개 이상의 대괄호 항목이 오는 것을 엄격히 금지한다.
      4. **언어 라벨링 절대 금지**: \`(越南语)\`, \`(English)\`, \`(베트남어)\` 등 어떤 언어의 종류를 설명하는 괄호나 텍스트를 절대 쓰지 마라.

      **[⚠️ 강제 이행 명령]**
      2. **필수적 딥스캔(Deep Scan)**: '가독성'은 헤더 삭제와 **내용의 극한 간결화**를 의미한다. 장황한 설명은 금지하며, 핵심 이미지나 어원을 **본질만 담아 짧고 강렬하게** 기술하라. (모바일 가독성 최우선)
      3. **한국어 전용 (Zero English & Zero Labeling)**: 당신의 사용자는 한국인 학습자이다. 원문을 제외한 모든 텍스트에서 영단어를 영원히 제거하라. 또한 \`(越南语)\`, \`(English)\` 등 원치 않는 언어 표시 라벨을 붙이는 행위를 즉각 중단하라.
      4. **금지된 예시 (NEVER DO THIS)**:
         - \`[Dạ / 네 / polite acknowledgement]\` (X) -> 영문 제거 대상
         - \`[Dạ / 네 / (越南语) 공손한 대답]\` (X) -> 언어 라벨링 \`(越南语)\` 제거 대상
         - \`[한 / 하나 / one]\` (X) -> 영문 제거 대상 (한자 mapping만 허용)
         - \`[및 / 그리고 / and]\` (X) -> 영문 제거 대상
      5. **무조건적 전수 분석**: 문장이 아무리 짧거나 단순하더라도 위 7대 원칙에 따라 분석해야 하며, 분석을 생략하는 문장이 있어서는 절대 안 된다.
      6. **가독성 극대화**: 모든 \`grammar\` 필드는 불필요한 서술 없이 곧바로 \`[단어 / 뜻 / 딥스캔 해설]\` 형식의 리스트로 시작한다.

      **[🇺🇸 영어 정밀 분석 참조 예시 1]**
      원본: Because the global economic situation is constantly changing, our company must develop flexible strategies to secure a competitive advantage.
      - translation: 세계 경제 상황이 끊임없이 변하고 있기 때문에, 우리 회사는 유연한 전략을 개발해야 합니다.
      - word_analysis: [
        { "word": "Because the global economic situation", "meaning": "[원인 및 주어부] 세계 경제 상황이 ~하기 때문에", "grammar": "[Because / ~때문에 / 근거를 예고하는 표지판] \n [global economic situation / 세계 경제 상황 / 지구 전체의 돈의 흐름]" },
        { "word": "is constantly changing", "meaning": "[동사구] 끊임없이 변하고 있다", "grammar": "[constantly / 끊임없이 / 멈추지 않는 연속성] \n [changing / 변하는 / 탈바꿈하는 역동적 이미지]" },
        { "word": "our company must develop", "meaning": "[주어 및 동사구] 우리 회사는 개발해야 한다", "grammar": "[our company / 우리 회사 / 우리가 일하는 집단] \n [must develop / 반드시 개발해야 한다 / 알맹이를 키워내는 과정]" },
        { "word": "flexible strategies", "meaning": "[목적어구] 유연한 전략들을", "grammar": "[flexible / 유연한 / 고무줄처럼 휘어지는 유연함] \n [strategies / 전략들 / 승리를 위한 치밀한 계획]" }
      ]

      **[🇻🇳 베트남어 정밀 분석 참조 예시 1]**
      원본: Mặc dù quá trình công nghiệp hóa mang lại nhiều lợi ích về kinh tế.
      - translation: 비록 공업화 과정이 경제적으로 많은 이익을 가져다주지만.
      - word_analysis: [
        { "word": "Mặc dù quá trình", "meaning": "[양보 접속사 및 주어] 비록 과정이 ~할지라도", "grammar": "[Mặc dù / 비록 ~일지라도 / 반전을 꾀하는 논리] \n [quá trình / 과정 / 過(지나다) + 程(길) = 일이 진행되는 길목]" },
        { "word": "công nghiệp hóa", "meaning": "[목적어] 공업화", "grammar": "[công nghiệp hóa / 공업화 / 工(일) + 業(일) + 化(되다) = 산업 체제로의 변화]" },
        { "word": "mang lại nhiều lợi ích", "meaning": "[동사 및 목적어구] 많은 이익을 가져오다", "grammar": "[mang lại / 가져오다 / 나에게 끌어오는 동작] \n [lợi ích / 이익 / 利(이롭다) + 益(더하다) = 나에게 보탬이 되는 것]" },
        { "word": "về kinh tế", "meaning": "[보어구] 경제에 관하여", "grammar": "[về / ~에 관하여 / 화제의 방향 지정] \n [kinh tế / 경제 / 經(다스리다) + 濟(제: 건너다) = 가계를 꾸려가는 흐름]" }
      ]

      **[사용자 입력 상황]**
      상황: "${promptInput}"
      대상 언어: ${language}
      
      ${baseInstruction}
    `;

    const result = await generateContentWithRetry(model, prompt);
    let text = result.response.text();

    // Clean up markdown code blocks if present
    if (text.includes('```')) {
      text = text.replace(/```json|```/g, '').trim();
    }

    const data = JSON.parse(text);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API] Error generating script:', error);

    // Check if it's a rate limit error to return 429
    const isRateLimit = error.message?.includes('429') ||
      error.message?.includes('Resource exhausted') ||
      error.message?.includes('Too Many Requests');

    return NextResponse.json({
      error: isRateLimit ? 'Rate limit exceeded' : 'Failed to generate script',
      details: isRateLimit
        ? 'Gemini 2.0 Flash has lower rate limits. Please try again in 30-60 seconds, or switch to Gemini 2.5 Flash for better stability.'
        : error.message
    }, { status: isRateLimit ? 429 : 500 });
  }
}
