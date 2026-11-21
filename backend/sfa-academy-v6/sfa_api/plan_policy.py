"""One table. Stages 1–7 (M1–M5, A6, A7) may be graded with no Final Paper Plan.
Stage 8 (A8) always requires the plan. To change a week, edit this dict only.
"""
PLAN_POLICY = {
    1: 'optional',  # M1
    2: 'optional',  # M2
    3: 'optional',  # M3
    4: 'optional',  # M4
    5: 'optional',  # M5
    6: 'optional',  # A6
    7: 'optional',  # A7
    8: 'required',  # A8
}
MISSION = {1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4', 5: 'M5', 6: 'A6', 7: 'A7', 8: 'A8'}


def plan_policy(stage):
    if stage not in PLAN_POLICY:
        return 'required'
    return PLAN_POLICY[stage]


def plan_policy_table():
    return [{'stage': stage, 'mission': MISSION[stage], 'planPolicy': policy} for stage, policy in PLAN_POLICY.items()]
