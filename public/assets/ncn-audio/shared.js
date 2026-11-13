export const AUDIO_PRICE=100000;
export const AUDIO_ORIGINAL_PRICE=200000;
export const MAX_AUDIO_SAMPLE_BYTES=4*1024*1024;
export const AUDIO_MIC='<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1m-7 8v4m-4 0h8"/>';
export const AUDIO_TOOL={
 id:'audio',title:'Đặt thu Audio',href:'/thu-audio/',group:'ban-hang',icon:'mic',tone:'teal',badge:'NEW',
 description:'Đặt thu lời rao khuyến mãi, sự kiện và nhận diện siêu thị.'
};
export const withAudioTool=tools=>[AUDIO_TOOL,...(Array.isArray(tools)?tools.filter(tool=>tool?.id!==AUDIO_TOOL.id):[])];
