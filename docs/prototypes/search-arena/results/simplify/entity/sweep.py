import sys; sys.path.insert(0, "harness")
import simp_entity as E
FINAL = {
    "entity-sw-lb5": E.variant(lead_billing=5),
    "entity-sw-m07": E.variant(minor_credit=0.7),
    "entity-sw-lb5-m07": E.variant(lead_billing=5, minor_credit=0.7),
}
