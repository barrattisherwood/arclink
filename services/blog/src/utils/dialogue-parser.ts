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

export interface FixtureDialogue {
  matchLabel: string;
  blocks: DialogueBlock[];
}

export interface ParsedWeeklyRoundup {
  fixtures: FixtureDialogue[];
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

export function parseWeeklyRoundup(raw: string): ParsedWeeklyRoundup {
  const fixtureRegex = /\[FIXTURE:\s*([^\]]+)\]([\s\S]*?)\[\/FIXTURE\]/gi;
  const fixtures: FixtureDialogue[] = [];
  let match;

  while ((match = fixtureRegex.exec(raw)) !== null) {
    const matchLabel = match[1].trim();
    const fixtureContent = match[2];

    const parsed = parseDialogueContent(fixtureContent);

    if (!parsed.isValid) {
      return {
        fixtures: [],
        isValid: false,
        error: `Invalid dialogue in fixture "${matchLabel}": ${parsed.error}`,
      };
    }

    fixtures.push({ matchLabel, blocks: parsed.blocks });
  }

  if (fixtures.length === 0) {
    // Try single-fixture fallback (v1 format — bare KWAGGA/MARCUS blocks)
    const parsed = parseDialogueContent(raw);
    if (parsed.isValid) {
      return {
        fixtures: [{ matchLabel: '', blocks: parsed.blocks }],
        isValid: true,
      };
    }
    return {
      fixtures: [],
      isValid: false,
      error: 'No fixture blocks found',
    };
  }

  return { fixtures, isValid: true };
}
