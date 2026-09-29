import { Fragment } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

/** Minimal markdown for tutor answers: **bold**, "- " / "* " bullets and "#" headings. */
export function RichText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const lines = text.split('\n');
  return (
    <Text style={style}>
      {lines.map((raw, li) => {
        let line = raw;
        let heading = false;
        if (/^#{1,6}\s/.test(line)) {
          line = line.replace(/^#{1,6}\s/, '');
          heading = true;
        }
        line = line.replace(/^\s*[-*]\s+/, '• ');
        const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <Fragment key={li}>
            {parts.map((part, pi) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <Text key={pi} style={{ fontWeight: '700' }}>
                  {part.slice(2, -2)}
                </Text>
              ) : (
                <Text key={pi} style={heading ? { fontWeight: '700' } : undefined}>
                  {part}
                </Text>
              ),
            )}
            {li < lines.length - 1 ? '\n' : null}
          </Fragment>
        );
      })}
    </Text>
  );
}
