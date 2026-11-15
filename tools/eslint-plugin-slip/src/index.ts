/**
 * Slip's own lint rules (design-system spec). They keep raw design values out
 * of component code, so the tokens stay the single source of colour and
 * spacing. Styles in CSS files are checked by the tests in ../test, since
 * ESLint does not read CSS.
 */
import type { Rule } from 'eslint';

/** A whole string that is a colour literal: #rgb, #rgba, #rrggbb or #rrggbbaa. */
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** A colour function anywhere in a string. */
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;

export function isRawColour(text: string): boolean {
  return HEX.test(text.trim()) || COLOUR_FUNCTION.test(text);
}

/** Style properties that are spacing: margins, paddings and gaps, in camel case as React writes them. */
const SPACING =
  /^(?:(?:margin|padding)(?:Top|Right|Bottom|Left|Block|Inline|BlockStart|BlockEnd|InlineStart|InlineEnd)?|gap|rowGap|columnGap)$/;

export function isSpacingProperty(name: string): boolean {
  return SPACING.test(name);
}

/** A spacing value that is not a token: a non-zero number (React adds px) or a string with px in it. */
export function isRawSpacing(value: unknown): boolean {
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return /\d(?:\.\d+)?px\b/.test(value);
}

const noRawColor: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'No colour literals outside tokens.css: use a colour token.' },
    messages: {
      raw: 'Colour {{value}} is not a token. Use a colour token such as var(--text-primary), or add one to tokens.css.',
    },
    schema: [],
  },
  create(context) {
    const check = (node: Rule.Node, text: string) => {
      if (isRawColour(text))
        context.report({
          node,
          messageId: 'raw',
          data: { value: JSON.stringify(text.trim().slice(0, 40)) },
        });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node as unknown as Rule.Node, node.value.raw);
      },
    };
  },
};

const noRawSpacing: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'No pixel values for margin, padding or gap in style props: use a space token.',
    },
    messages: {
      raw: '{{name}} uses a raw value. Use a space token such as var(--space-2).',
    },
    schema: [],
  },
  create(context) {
    return {
      // Any object written as the value of a style attribute.
      'JSXAttribute[name.name="style"] > JSXExpressionContainer > ObjectExpression > Property'(
        node: Rule.Node,
      ) {
        const property = node as unknown as {
          key: { type: string; name?: string; value?: unknown };
          value: { type: string; value?: unknown; quasis?: { value: { raw: string } }[] };
        };
        const name =
          property.key.type === 'Identifier' ? property.key.name : String(property.key.value ?? '');
        if (!name || !isSpacingProperty(name)) return;
        const value = property.value;
        const raw =
          value.type === 'Literal'
            ? isRawSpacing(value.value)
            : value.type === 'TemplateLiteral'
              ? // `${n}px`: a number put in front of px is as raw as a written one.
                (value.quasis ?? []).some(
                  (quasi, index) =>
                    isRawSpacing(quasi.value.raw) || (index > 0 && /^px\b/.test(quasi.value.raw)),
                )
              : false;
        if (raw) context.report({ node, messageId: 'raw', data: { name } });
      },
    };
  },
};

const plugin = {
  meta: { name: '@slip/eslint-plugin', version: '0.1.0' },
  rules: { 'no-raw-color': noRawColor, 'no-raw-spacing': noRawSpacing },
};

export default plugin;
