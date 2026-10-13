"""Second-stage variants (pre-specified after the single-block screen)."""
def get(m):
    V = {}
    for mode, tree in (('F', 150), ('L', 0)):
        V[f'{mode}:leanq'] = m(tree=tree, extra='leanq'); V[f'{mode}:leans'] = m(tree=tree, extra='leans'); V[f'{mode}:src4'] = m(tree=tree, extra='src4')
        V[f'{mode}:src6+ps2'] = m(tree=tree, extra='src6', pscale=2.0)
        V[f'{mode}:tb_gap'] = m(tree=tree, tree_blocks=('gap',))
        V[f'{mode}:tb_scores'] = m(tree=tree, tree_blocks=('mcu', 'gap', 'logc', 'pop'))
        V[f'{mode}:src6+tb_gap'] = m(tree=tree, extra='src6', tree_blocks=('gap',))
        V[f'{mode}:src6+gap+logc'] = m(('gap', 'logc'), tree=tree, extra='src6')
    return V
