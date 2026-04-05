export interface DialogueBlock {
  persona: string;   // 'kwagga' | 'marcus'
  content: string;
  order: number;
}

export interface ParsedDialogue {
  blocks: DialogueBlock[];
  isValid: boolean;
  error?: string;
}

export function parseDialogueContent(raw: string): ParsedDialogue {
  const blockRegex = /\[(KWAGGA|MARCUS)\]([\s\S]*?)\[\/(KWAGGA|MARCUS)\]/gi;
  const blocks: DialogueBlock[] = [];
  let match;
  let order = 1;

  while ((match = blockRegex.exec(raw)) !== null) {
    const openTag = match[1].toLowerCase();
    const closeTag = match[3].toLowerCase();

    if (openTag !== closeTag) {
      return {
        blocks: [],
        isValid: false,
        error: `Mismatched tags: [${openTag}] closed with [/${closeTag}]`,
      };
    }

    blocks.push({ persona: openTag, content: match[2].trim(), order: order++ });
  }

  if (blocks.length < 2) {
    return {
      blocks: [],
      isValid: false,
      error: `Expected at least 2 dialogue blocks, found ${blocks.length}`,
    };
  }

  return { blocks, isValid: true };
}
