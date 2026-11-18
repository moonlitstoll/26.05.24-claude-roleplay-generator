import { SchemaType } from '@google/generative-ai';

const SPEAKERS_SCHEMA = {
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
};

const WORD_ANALYSIS_SCHEMA = {
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
};

// Stage 1: the lines and their Korean translation only. Word analysis comes from stage 2.
export const DIALOGUE_SCHEMA: any = {
  description: "Conversation script with speaker info",
  type: SchemaType.OBJECT,
  properties: {
    speakers: SPEAKERS_SCHEMA,
    script: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          speaker: { type: SchemaType.STRING, description: "Speaker identifier (A or B)" },
          text: { type: SchemaType.STRING, description: "The spoken text in target language" },
          translation: { type: SchemaType.STRING, description: "Korean translation" },
        },
        required: ["speaker", "text", "translation"],
      }
    }
  },
  required: ["speakers", "script"]
};

// Stage 2: word analysis for the requested lines, matched back to the script by `index`.
export const ANALYSIS_SCHEMA: any = {
  description: "Word analysis for the requested lines",
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER, description: "The line number given in the request, copied as-is" },
          word_analysis: WORD_ANALYSIS_SCHEMA,
        },
        required: ["index", "word_analysis"],
      }
    }
  },
  required: ["items"]
};

export function getBaseInstruction(
  mode: 'roleplay' | 'analysis',
  count: number,
  language: string,
  promptInput: string
): string {
  const isAnalysisMode = count === 0 && mode === 'analysis';
  const isMonologueMode = count === 0 && mode === 'roleplay';

  if (isAnalysisMode) {
    return `
      VERBATIM ANALYSIS MODE ACTIVATED:
      - DO NOT generate a roleplay or conversation.
      - IF the user's "Input" is already in the target language (${language}), use it EXACTLY as it is for the 'text' field.
      - IF the user's "Input" is in Korean, you MUST FIRST translate the Korean input into a natural and highly authentic ${language} sentence. Use this translated ${language} sentence as the 'text' field, and the original Korean input as the 'translation' field.
      - SEGMENTATION STRATEGY:
        1. Split the ${language} text into INDIVIDUAL sentences for granular analysis.
      - Assign all segments to Speaker "A".
      - Provide the translation of every segment in Korean ONLY.
    `;
  }

  if (isMonologueMode) {
    return `
      MONOLOGUE GENERATION MODE ACTIVATED (Speaker A Only):
      - **GOAL**: Generate a LONG, detailed monologue by Speaker A based on the "Input Context".
      - **LENGTH**: The user requested "as long as possible". Generate at least 8-12 sentences/segments.
      - **CONTENT**: Deeply explore the topic, expressing thoughts, feelings, and descriptions.
      - **FORMAT**:
        - ONLY Speaker "A". No Speaker "B".
        - Split the monologue into logical segments (1-2 sentences per segment) for easier reading and analysis.
      - **STYLE**: Natural, native-level speech with appropriate flow and markers.
    `;
  }

  return `
    Generate exactly ${count * 2} lines of conversation (alternating between speaker A and B).
    SCENARIO: "${promptInput}"

    CRITICAL INSTRUCTION - MAX DIVERSITY & NATIVE REALISM:
    - **Infinite Persona & Relationship Dynamics**: DO NOT limit personalities to just 'angry' or 'friendly' or 4 strict categories. Create an incredibly diverse spectrum of human relationships (e.g., a weary retail worker vs. an overly chatty customer, siblings teasing each other, roommates passively arguing over chores, polite but passive-aggressive neighbors, two gym bros spotting each other, or a tech-savvy grandkid helping a confused grandparent). The permutations should be endless. Let their distinct personalities and relationship dictate their vocabulary, tone, slang, and filler words.
    - **Native-Level Polish**: Use raw, real-world native expressions. Even for basic textbook topics, you MUST inject native flare, idioms, filler words (uh, like, you know, etc.), and natural speech patterns. Make it sound like a real conversation overheard on the street.
    - **Scenario Flow**: Maintain a highly authentic conversational flow appropriate for the dynamic.

    GENDER ASSIGNMENT:
    - Assign logical genders to Speakers A and B based on the scenario/personas.
  `;
}

export interface AnalysisLine {
  index: number;
  speaker: string;
  text: string;
  translation: string;
}

// Stage 1 prompt: write (or segment) the lines and translate them.
export function buildDialoguePrompt(promptInput: string, language: string, baseInstruction: string): string {
  return `
    너는 베트남어와 영어 원어민 회화 대본을 쓰고 한국어로 옮기는 전문가다. 사용자는 한국인 학습자다.

    **[출력 규칙]**
    - 원문(\`text\`): 대상 언어(${language})로만 작성한다.
    - 번역(\`translation\`): 큰따옴표 없이 한국어로만 작성한다.

    **[사용자 입력 상황]**
    상황: "${promptInput}"
    대상 언어: ${language}

    ${baseInstruction}
  `;
}

// The analysis rules below are unchanged from the single-request version.
const ANALYSIS_RULES = `
    너는 베트남어와 영어를 분석하는 **'초정밀 언어 공학자'** (회화 강화형)이다. 다음의 지침을 최우선 순위로 준수하며, 예외 없이 강제 적용하라.

    **[📋 시스템 미션]**
    당신은 베트남어와 영어를 분석하여 사용자의 회화 감각을 극대화하는 **'초정밀 언어 공학자'**입니다. 단순히 문법을 설명하는 것을 넘어, 문장의 논리적 설계 구조와 단어가 가진 '이미지'를 뇌에 이식하는 것을 목표로 합니다.

    **[📏 분석 8대 원칙]**
    1. **전수 및 순차 분석**: 문장 내 모든 단어와 청크를 등장 순서대로 빠짐없이 분석한다. (부호 제외)
    2. **독립적 재설명**: 중복 단어라도 매번 처음부터 끝까지 상세히 풀이한다. (생략 절대 불가)
    3. **의미 덩어리(Chunk) 분석**: 의미가 연결되는 단어군을 하나의 청크 항목으로 묶어 최우선 분석한다.
    4. **역할 명시**: 청크 해설의 의미 필드(meaning)에는 반드시 문법적 역할을 [주어], [동사], [목적어], [원인 접속사], [양보 접속사] 등 약어 없이 풀어서 병기한다. (예: [동사구] 가져다주다)
    5. **언어 통제 (최상위 절대 원칙)**: 원문(text)을 제외한 **모든 해설은 반드시 한국어로만 작성**하며, 번역문(translation)에서 큰따옴표는 절대 생략한다. 영단어를 섞어서 설명하는 행위를 엄격히 금지한다.
    6. **[Deep Scan] 베트남어 특화 (한자 출력 절대 불가)**:
       - **단어별 단일 행(One Line) 분석**: 모든 단어(복합어 포함) 설명은 반드시 한 줄에 끝내십시오. 다음절 단어나 복합어는 청크로 묶되, 설명 뒷부분에서 반드시 음절별로 쪼개어 뜻과 한자를 다시 한번 상세히 설명하십시오. (예: phó thủ lãnh đạo / 부지도자, 부총리 / (phó (버금 부) + thủ: 머리, 수장 (머리 수) + lãnh đạo: 지도자 (lãnh: 거느릴 령 + đạo: 이끌 도))).
       - **한자 기반 풀이 통합**: 한자 기반 단어 분석 시에도 별도의 행을 생성하지 마십시오. 절대로 실제 한자 문자(限, 薄 등)를 쓰지 말고, 어떤 한자인지만 괄호 안의 '한글 뜻과 음'(예: 물 수, 하늘 천)으로만 알려주십시오. (예: tiền cọc / 보증금 / (tiền (돈 전) + cọc (보증))).
    7. **[Deep Scan] 영어 특화**: 개별 단어의 문맥적 뜻과 더불어, 해당 단어가 머릿속에 그리는 **핵심 이미지를 모바일 가독성을 위해 본질만 짧게** 설명한다. (대괄호 없이 슬래시 구분자 \`/ \` 사용)

    **[📱 출력 포맷 가이드]**
    - 번역(\`translation\`): 큰따옴표 없이 한국어로만 작성한다.
    - 의미(\`meaning\`): **[문법 역할] 청크 전체 의미** (예: [원인 접속사] ~하기 때문에)
    - 해설(\`grammar\`): **단어 / 뜻 / 어원 및 이미지 상세 해설** (대괄호 \`[]\` 금지, 슬래시 \` / \`로 구분, 개행 문자 \\n으로 연결)

    **중요 Rules (절대 준수):**
    1. **헤더 삭제**: '청크 제목 [역할]: 의미' 와 같은 첫 줄(중복 정보)을 절대 쓰지 말고, 즉시 첫 번째 분석 텍스트부터 시작한다.
    2. **가독성(형식)**: 한 줄에 하나씩 분석 항목을 배치하되, 대괄호 \`[]\`를 사용하지 마라. 하나의 청크 분석은 반드시 \` / \`로 구분된 한 줄(One Line)에 모두 담기게 작성하라.
    3. **언어 라벨링 절대 금지**: \`(越南语)\`, \`(English)\`, \`(베트남어)\` 등 어떤 언어의 종류를 설명하는 괄호나 텍스트를 절대 쓰지 마라.

    **[⚠️ 강제 이행 명령]**
    2. **필수적 딥스캔(Deep Scan)**: '가독성'은 헤더 삭제와 **내용의 극한 간결화**를 의미한다. 장황한 설명은 금지하며, 한자 뜻음과 핵심 이미지를 **대괄호 없이 한 줄(One Line) 안에 \`/ \`로 구분하여** 짧고 강렬하게 담아라.
    3. **한국어 전용 (Zero English & Zero Hanja)**: 당신의 사용자는 한국인 학습자이다. 원문을 제외한 모든 텍스트에서 영단어와 한자 문자(漢字)를 영원히 제거하라. 또한 \`(越南语)\`, \`(English)\` 등 언어 표시 라벨을 붙이는 행위를 즉각 중단하라.
    4. **금지된 예시 (NEVER DO THIS)**:
       - \`Dạ / 네 / polite acknowledgement\` (X) -> 영문 제거 대상
       - \`Dạ / 네 / (越南语) 공손한 대답\` (X) -> 언어 라벨링 \`(越南语)\` 제거 대상
       - \`한 / 하나 / one\` (X) -> 영문 제거 대상 (한자 mapping만 허용)
       - \`quá trình / 과정 / 過(지날 과) + 程(길 정)\` (X) -> 실제 한자 문자 제거 및 대괄호 금지
       - \`및 / 그리고 / and\` (X) -> 영문 제거 대상
    5. **무조건적 전수 분석**: 문장이 아무리 짧거나 단순하더라도 위 7대 원칙에 따라 분석해야 하며, 분석을 생략하는 문장이 있어서는 절대 안 된다.
    6. **가독성 극대화**: 모든 \`grammar\` 필드는 불필요한 서술 없이 곧바로 \`단어 / 뜻 / 딥스캔 해설\` 형식의 리스트로 시작한다. (대괄호 절대 금지)

    **[🇺🇸 영어 정밀 분석 참조 예시 1]**
    원본: Because the global economic situation is constantly changing, our company must develop flexible strategies to secure a competitive advantage.
    - translation: 세계 경제 상황이 끊임없이 변하고 있기 때문에, 우리 회사는 유연한 전략을 개발해야 합니다.
    - word_analysis: [
      { "word": "Because the global economic situation", "meaning": "[원인 및 주어부] 세계 경제 상황이 ~하기 때문에", "grammar": "Because / ~때문에 / 근거를 예고하는 표지판 \\n global economic situation / 세계 경제 상황 / 지구 전체의 돈의 흐름" },
      { "word": "is constantly changing", "meaning": "[동사구] 끊임없이 변하고 있다", "grammar": "constantly / 끊임없이 / 멈추지 않는 연속성 \\n changing / 변하는 / 탈바꿈하는 역동적 이미지" },
      { "word": "our company must develop", "meaning": "[주어 및 동사구] 우리 회사는 개발해야 한다", "grammar": "our company / 우리 회사 / 우리가 일하는 집단 \\n must develop / 반드시 개발해야 한다 / 알맹이를 키워내는 과정" },
      { "word": "flexible strategies", "meaning": "[목적어구] 유연한 전략들을", "grammar": "flexible / 유연한 / 고무줄처럼 휘어지는 유연함 \\n strategies / 전략들 / 승리를 위한 치밀한 계획" }
    ]

    **[🇻🇳 베트남어 정밀 분석 참조 예시 1]**
    원본: Nhân viên lãnh đạo đang nộp tiền cọc.
    - translation: 지도부 직원이 보증금을 내고 있습니다.
    - word_analysis: [
      { "word": "Nhân viên", "meaning": "[주어] 직원", "grammar": "Nhân viên / 직원 / (nhân (사람 인) + viên (인원 원))" },
      { "word": "lãnh đạo", "meaning": "[수식어] 지도하는", "grammar": "lãnh đạo / 지도자 / (lãnh (거느릴 령) + đạo (이끌 도))" },
      { "word": "đang nộp", "meaning": "[동사구] 내고 있는 중이다", "grammar": "đang / ~하는 중이다 / 진행형 조동사 \\n nộp / 내다, 제출하다 / 안으로 들여보내는 이미지" },
      { "word": "tiền cọc", "meaning": "[목적어구] 보증금을", "grammar": "tiền cọc / 보증금 / (tiền (돈 전) + cọc (보증))" }
    ]
`;

// Stage 2 prompt: analyze only the target lines; the whole script rides along as context
// so tone, pronouns and who-says-what stay consistent across batches.
export function buildAnalysisPrompt(language: string, lines: AnalysisLine[], targets: number[]): string {
  const targetSet = new Set(targets);
  const context = lines
    .map(l => `    [${l.index}] ${l.speaker}: ${l.text}`)
    .join('\n');
  const targetBlock = lines
    .filter(l => targetSet.has(l.index))
    .map(l => `    [${l.index}] ${l.speaker}: ${l.text}\n        번역: ${l.translation}`)
    .join('\n');

  // Asking for analysis on its own makes the model more thorough, and it starts inventing Hanja
  // readings for native Vietnamese words (measured 2026-11-18: ~0.5 per line vs ~0.02 before the split).
  const hanjaGuard = language === 'Vietnamese'
    ? '\n    - 한자 뜻음(예: 돈 전)은 한자에서 온 낱말(한월어)에만 붙인다. 순수 베트남어 낱말(nhà, thuê, xem, tháng, người, chào 등)에는 한자 뜻음을 지어 붙이지 말고 뜻과 이미지만 적는다.'
    : '';

  return `${ANALYSIS_RULES}
    **[대본 전체 - 문맥 참고용]**
    대상 언어: ${language}
${context}

    **[분석 대상]**
    아래 문장만 분석한다. 문맥 참고용 문장은 뜻과 말투를 해석하는 데만 쓰고, 분석 결과로 출력하지 않는다.
${targetBlock}

    **[출력]**
    - 분석 대상 문장마다 항목 하나를 만들고, \`index\`에는 대괄호 안의 번호를 그대로 적는다.
    - 분석 대상 ${targets.length}개 문장을 하나도 빠뜨리지 않는다.${hanjaGuard}
  `;
}
