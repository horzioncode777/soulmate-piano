function interpolate(points,value){const x=Math.max(points[0][0],Math.min(points.at(-1)[0],value));for(let i=1;i<points.length;i++){const [right,b]=points[i],[left,a]=points[i-1];if(x===right)return b;if(x<right)return a+(b-a)*(x-left)/(right-left);}return points.at(-1)[1];}
// Curve 11 and release velocity curve from the downloaded Lite SFZ.
export const pedalCurve=value=>interpolate([[0,0],[32,0],[42,.1],[64,.3],[72,.4],[73,1],[127,1]],value);
export const releaseGain=velocity=>interpolate([[0,.001],[20,.005],[40,.01],[80,.1],[127,1]],velocity);
export const pedalReleaseController=value=>Math.round(pedalCurve(value)*127);
export const fullPedal=value=>value>=73;
