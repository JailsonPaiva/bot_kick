/**
 * Layout dedicado ao Browser Source do OBS — html/body devem ser transparentes.
 */
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background: transparent !important;
              background-color: rgba(0, 0, 0, 0) !important;
            }
          `,
        }}
      />
      {children}
    </>
  )
}
