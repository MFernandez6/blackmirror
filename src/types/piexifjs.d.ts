declare module "piexifjs" {
  const piexif: {
    GPSHelper: {
      degToDmsRational: (deg: number) => number[][];
    };
    GPSIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    ImageIFD: Record<string, number>;
    dump: (exif: unknown) => string;
    insert: (exifBytes: string, jpeg: string) => string;
  };
  export default piexif;
}
