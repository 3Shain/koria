class HierarchicalId {
  private constructor(
    private readonly _map: number[],
    private readonly _rootToken: any[]
  ) {
    // assert(_map.length === _rootToken.length)
  }

  static root(rootToken: any) {
    return new HierarchicalId([0], [rootToken]);
  }

  next() {
    return new HierarchicalId(
      [...this._map.slice(0, -1), this._map[this._map.length - 1] + 1],
      this._rootToken
    );
  }

  hierarchy(rootToken: any) {
    // if(rootToken)
    return new HierarchicalId(
      [...this._map, 0],
      [...this._rootToken, rootToken]
    );
  }

  checkReachability(target: HierarchicalId) {
    for (let i = 0; i < this._map.length; i++) {
      if (i >= target._map.length) {
        return false;
      }
      if (this._rootToken[i] !== target._rootToken[i]) {
        return false; // not the same branch
      }
      if (this._map[i] < target._map[i]) {
        /** what about equal? */
        return false; // prior than target
      }
    }
    return true;
  }
}

export { HierarchicalId };
