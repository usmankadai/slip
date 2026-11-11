import styles from './stories.module.css';
import { useTokenValue } from './tokenValue.ts';

export function Swatch({ token, note }: { token: string; note?: string }) {
  const value = useTokenValue(token);
  return (
    <div className={styles.swatch}>
      <div className={styles.chip} style={{ background: `var(${token})` }} />
      <div className={styles.meta}>
        <span className={styles.name}>{token}</span>
        <span className={styles.note}>
          {value}
          {note ? `. ${note}` : ''}
        </span>
      </div>
    </div>
  );
}

export function TokenValue({ token }: { token: string }) {
  return <>{useTokenValue(token)}</>;
}
