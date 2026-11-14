import { hourlySlots } from './api.mjs';
import { priceForContract } from './domain.mjs';

/** Presentation resolution never changes the supplier's confirmed settlement period. */
export function consumerPriceSlots(intervals, contract, { resolution = 'hour', mode = 'market' } = {}) {
  const hours = hourlySlots(intervals);
  const source = resolution === 'hour' ? hours : intervals;
  const confirmed = contract?.confirmed === true && (contract.type === 'fixed' ||
    (contract.type === 'dynamic' && ['hour', 'quarter'].includes(contract.resolution)));
  return source.map(slot => {
    const effectiveMarket = contract?.type === 'dynamic' && contract.resolution === 'hour'
      ? hours.find(hour => Date.parse(slot.start) >= Date.parse(hour.start) && Date.parse(slot.start) < Date.parse(hour.start) + hour.durationMinutes * 60000)?.market
      : slot.market;
    const price = confirmed && Number.isFinite(effectiveMarket)
      ? priceForContract(effectiveMarket, { ...contract, exportRate:Number(contract.exportRate)||0, exportFee:Number(contract.exportFee)||0 }) : null;
    const value = mode === 'market' ? slot.market / 1000
      : mode === 'export' && contract?.exportConfirmed === true ? price?.exportNet
      : mode === 'import' ? price?.importRate : null;
    return { ...slot, price:price?.importRate ?? slot.market / 1000, displayValue:Number.isFinite(value) ? 100 * value : null, solarKwh:0 };
  });
}
