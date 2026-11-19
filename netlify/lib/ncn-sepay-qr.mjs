// VietinBank personal accounts notify SePay only for transfers marked SEVQR.
export const sepayDescription=code=>'SEVQR '+code;

export function sepayQR({account,bank,amount},code){
 const description=sepayDescription(code),qr=new URL('https://vietqr.app/img');
 qr.search=new URLSearchParams({acc:account,bank,amount:String(amount),des:description}).toString();
 return {description,qrUrl:qr.href};
}
