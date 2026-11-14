// Editable annual scenario assumptions. Never used as current price data.
export const initialProfile = Object.freeze({annualUse:4200,annualSolar:4000,selfUsePct:30,targetPct:50,importRate:.30,exportRate:.10,exportFee:.05,investment:5500,extraSolarStored:1000,roundTripEfficiency:.90,annualCosts:35,lifeYears:15});
export const devices = Object.freeze({
  dishwasher:{name:'Vaatwasser',description:'Een wasbeurt',durationHours:2,energyKwh:1.1,icon:'dishwasher'},
  washing:{name:'Wasmachine',description:'Een was op 40 °C',durationHours:2,energyKwh:.8,icon:'washing'},
  car:{name:'Elektrische auto',description:'10 kWh bijladen',durationHours:3,energyKwh:10,icon:'car'},
});

