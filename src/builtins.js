// Los bancos opcionales se instalan en la copia personal del usuario.
export const builtins={
  kawai:{maker:'SOULMATE · BIBLIOTECA DE PIANOS',name:'Kawai Upright KW',type:'Upright Piano',description:'El piano vertical de tu colección. Dos capas de intensidad y un sonido cercano para practicar cada día.',file:'/assets/banks/UprightPianoKW.sf2'},
  steinway:{optional:true,maker:'SOULMATE · BIBLIOTECA DE PIANOS',name:'Steinway Model D',type:'Abbey · Concert Grand',description:'Integración opcional de Abbey Steinway D. Requiere su banco local y autorización de uso.',file:'/assets/banks/Abbey-Steinway-D-v1.9.sf2'},
  yamaha:{optional:true,maker:'SOULMATE · BIBLIOTECA DE PIANOS',name:'Yamaha CFX',type:'Concert Grand',description:'Integración opcional de Yamaha CFX. Requiere su banco local y autorización de uso.',gainDb:24,file:'/assets/banks/Yamaha-CFX-Grand.sf2'},
  bosendorfer:{optional:true,maker:'THE EXPERIENCE · DORE MARK',name:'Bösendorfer 290',type:'Austrian Concert · Lite',description:'Seis capas del B290 Lite y muestras con pedal levantado y presionado. Adaptación para el sampler integrado.',gainDb:9,file:'/assets/banks/B290-Lite.sf3',pedalPrograms:true}
};
