import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** `primary` is the one main action on a screen. `quiet` reads as a link. */
  variant?: 'default' | 'primary' | 'quiet';
}

export function Button({ variant = 'default', type = 'button', ...rest }: ButtonProps) {
  const variantClass =
    variant === 'primary' ? styles.primary : variant === 'quiet' ? styles.quiet : '';
  return <button type={type} className={`${styles.button} ${variantClass}`} {...rest} />;
}
