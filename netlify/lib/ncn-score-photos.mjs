import sharp from 'sharp';
export async function scorePhoto(bytes){
 const image=sharp(bytes,{limitInputPixels:1_000_000,animated:false}),meta=await image.metadata();
 if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw Error('Unsupported image');
 return image.rotate().resize(96,96,{fit:'cover'}).webp({quality:82}).toBuffer();
}
