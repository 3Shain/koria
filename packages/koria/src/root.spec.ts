import { describe, it } from 'vitest';
import { state, root } from './root';

describe('root', () => {

  it('', () => {
    const p = root(()=>{
      const [states,setState] = state.fromValue(0);

      return {
        state,
        setState
      }
    });
    // p.state.subscribe
  })

})
