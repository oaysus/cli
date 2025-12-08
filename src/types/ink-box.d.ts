declare module 'ink-box' {
  import { FC, ReactNode } from 'react';

  interface BoxProps {
    children?: ReactNode;
    borderStyle?:
      | 'single'
      | 'double'
      | 'round'
      | 'bold'
      | 'singleDouble'
      | 'doubleSingle'
      | 'classic';
    borderColor?: string;
    backgroundColor?: string;
    padding?: number;
    margin?: number;
    float?: 'left' | 'right' | 'center';
    align?: 'left' | 'center' | 'right';
    dimBorder?: boolean;
    title?: string;
    titleAlignment?: 'left' | 'center' | 'right';
  }

  const Box: FC<BoxProps>;
  export default Box;
}
