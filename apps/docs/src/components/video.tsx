type VideoProps = React.ComponentProps<'video'> & {
  src: string;
};

export function Video({ src, style, ...props }: VideoProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const videoSrc = src.startsWith('/') ? `${basePath}${src}` : src;

  return (
    <video
      src={videoSrc}
      style={{
        width: '100%',
        borderRadius: '8px',
        marginBottom: '1rem',
        marginTop: '1rem',
        ...style,
      }}
      {...props}
    />
  );
}
