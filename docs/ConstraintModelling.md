# Constraint Modelling

This document explains how the scheduling problem is formalised to pass into a CP-SAT solver.

## 1. Sets

- $a \in A$: activities
- $c \in C$: contracts
- $w \in W = \{1, ..., T\}$: planning weeks (`06_PARAMETERS.horizon_weeks`)
- $l \in L = L_{\text{sec}} \cup L_{\text{plat}}$: physical locations partitioned into track tunnel sectors ($L_{\text{sec}}$) and station platform sectors ($L_{\text{plat}}$)
- $h \in H$: `(contract_number, activity_type)` groups
- $n \in N_c = \{1, ..., M_c\}$: local access-night indices available to contract $c$
- $g \in G_l$: candidate possession groups at location $l$
- $\lambda \in \Lambda = \{ALP, BET\}$: railway lines

For the provided CSVs, each contract has one activity type, practically allowing `h` to be replaced by `c`, but we respect the GitHub's `access_night` definition of using `h`.

## 2. Parameters

For activity $a$, 
- $c(a) \in C$ is its contract.
- $h(a) \in H$ is its contract/type group
- $q_a$ is its `total_accesses` workload
- $r_a$ is its planned-start week
- $p(a)$ is its predecessor, if any
- $\tau_a \in \{PM, PC, C\}$ is its access/possession type

For contract/group $h$,
- $M_h$ is its `number_of_maximum_access_per_week`
- $F_h$ is its `number_of_workfronts`

For location $l$:
- $K_l$ is the fixed weekly `supply_capacity` from `04_LOCATION_SUPPLY.csv`, which means the remaining number of accss nights per segment after in-house maintenance takes place.

## 3. Fixed spatial footprint of an activity

From its start/end locations, preprocess $R_a \subseteq L$, which are all actual tunnel/platform locations occupied by activity $a$.

### 3.1. Buffer

The protective buffer $B_a \subseteq L_{\text{sec}}$ consists of running track tunnel sectors adjacent to the work boundaries to ensure block separation:
- `2` refers to two adjacent tunnel sectors on both sides
- `1` refers to one adjacent tunnel sector on both sides
- Station platforms outside $R_a$ are not absorbed into $B_a$.

$$
B_a = \begin{cases}
  \text{up to 2 adjacent tunnel sectors on both sides} & \text{if } Live \\
  \text{up to 1 adjacent tunnel sector on both sides} & \text{if } NonLive(Consist) \\
  \empty & \text{if } NonLive(Others)
\end{cases}
$$

### 3.2. Live mirror

If the work is live, cutting third-rail traction power mirrors the de-energised track and platform closures onto the opposite bound ($MIR_a$).

### 3.3. Live interchange effect

If a Live activity affects H01-H02, cutting traction power at the interchange affects both lines' tunnels. $INT_a$ contains the corresponding other-line H01-H02 tunnel/platform closures on both bounds, expanded by the 2-sector buffer radius on that line and clipped at its termini (strictly enforced by the competition validator).

### 3.4. External exclusion footprint

We finally define the external exclusion footprint

$$
X_a = B_a \cup MIR_a \cup INT_a
$$

and total foorprint

$$
C_a = R_a \cup X_a
$$

## 4. Decision variables

### 4.1. Activity access assignment

$$x_{awn} \in \{0, 1\}$$

where 

$$x_{awn}=1$$

means activity $a$ receives an access in week $w$, using local access-night $n$ of its contract/type group.

Because an activity may receive at most one access per week, 

$$\sum_{n} x_{awn} \leq 1$$

Then, define 

$$y_{aw} \in \{0, 1\} = \sum_{n \in N_{h(a)}} x_{awn}$$

meaning activity $a$ operates somewhere in week $w$.

### 4.2. ECLO

$$e_{awn} \in \{0, 1\}$$

where 

$$e_{awn} = 1$$

means activity $a$ uses ECLO in week $w$, using local access-night $n$ of its contract/type group.

We enforce the fact that an activity can only use ECLO if it is already granted access in week $w$, local access-night $n$ by

$$e_{awn} \leq x_{awn}$$

### 4.3. Location possession/co-sharing assignment
For every $l \in R_a$,

$$z_{alwg} \in \{0, 1\}$$

means activity $a$'s occupancy of location $l$ in week $w$ belongs to posession/co-share group $g$.

Since the route is fixed,

$$\sum_{g \in G_{l}} z_{alwg} = y_{aw} \forall l \in R_a$$

If $a$ runs that week, it must appear once at every location in its route and be assigned to **exactly one** possession group at that location..

Note that $g$ may differ across locations for the same activity. The provided sample submission does exactly this—for example A001 uses `b2` on its platforms and `b4` on its tunnel sectors in the same week.

Define 

$$u_{lwg} \in \{0, 1\}$$

meaning possession group $g$ is actually used at location $l$, week $w$.

It follows that 

$$z_{alwg} \leq u_{lwg}$$

for every applicable $a$, and

$$u_{lwg} \leq \sum_{a:l \in R_a} z_{alwg}$$

Hence,

$$U_{lw} = \sum_{g} u_{lwg}$$

is the number of weekly access-nights slots consumed at location $l$.

## 5. The 10 hard constraints

### 5.1. Workload conservation

A normal access contributes $1$, an ECLO access contributes $1.5$, so

$$\sum_{w,n} (x_{awn} + \frac{1}{2} e_{awn}) \geq q_a$$

For CP-SAT, "integer-ize" the constraint:

$$2 \sum_{w,n} x_{awn} + \sum_{w,n} e_{awn} \geq 2q_a $$

### 5.2. Planned start date

$$x_{awn} = 0 \forall w < r_a$$

### 5.3. Predecessor precendence

Define

$$S_a = \min\{w: y_{aw} = 1\}$$
$$F_a = \max\{w: y_{aw} = 1\}$$

If

$$p(a) = b$$

then

$$S_a > F_b$$

or since weeks are integers,

$$S_a \geq F_b + 1$$

### 5.4. Closures and buffers

If activity $a$ operates, its working route $R_a$ is actively occupied, while locations in its external exclusion footprint $X_a$ are protected from external intrusion.

We define the spatial interference relation:

$$C_{ab} = 1 \iff (R_b \cap C_a \neq \empty) \lor (R_a \cap C_b \neq \empty)$$

where $C_a = R_a \cup X_a$.

**Key Rule Interpretation:**
- Interference occurs when an activity's actual work site ($R_b$) enters another activity's closure/buffer footprint ($C_a$), matching the competition validator rule `[Activity inside another group's closure zone]`.
- The term $(B_a \cap B_b \neq \empty)$ is intentionally **omitted**: when two disjoint activities' buffers touch in an unoccupied intermediate sector, the intermediate sector serves as the required physical separation buffer between the two worksites (Rule 4 canonical example: an activity whose buffer reaches S02 allows the next activity on that bound to start no earlier than S03).

### 5.5. Possession locations and legal mixes
For each $(l, w, g)$, define

$$PM_{lwg} = \sum_{a:l \in R_a, \tau_a = PM} z_{alwg}$$
$$PC_{lwg} = \sum_{a:l \in R_a, \tau_a = PC} z_{alwg}$$
$$C_{lwg} = \sum_{a:l \in R_a, \tau_a = C} z_{alwg}$$

Each possession slot $g \in G_l$ represents one distinct night of track possession at location $l$ in week $w$, packed up to legal mix limits:
one sole $PM$, one $PC$ with $\le 3$ $C$, or $\le 4$ $C$:

$$(PM_{lwg} + PC_{lwg} \leq 1) \land (C_{lwg} + PC_{lwg} + 4PM_{lwg} \leq 4)$$

Which means
- If $PM=1$ then no $PC$ or $C$
- If $PC=1$ then 3 or less $C$
- If $C$ only then 4 or less $C$

The total number of distinct possession slots used at location $l$ in week $w$ is:

$$U_{lw} = \sum_{g} u_{lwg}$$

which represents the number of access-nights consumed at location $l$, bounded by the nominal weekly supply $K_l$ according to scenario-specific rules.

### 5.6. Co-sharing exemption & separate possession nights

Under Rule 6, possession groups and spatial conflicts interact at two levels:

1. **Direct Worksite Co-Sharing ($R_a \cap R_b \neq \empty$)**:
   If $a$ and $b$ share a physical working location $l \in R_a \cap R_b$ in week $w$, they may co-share the exact same possession slot:
   $$z_{alwg} = z_{blwg} = 1$$
   When this holds, $a$ and $b$ share one possession night at $l$ and are exempt from each other's closure/buffer restrictions, subject to the legal mix constraints of Rule 5.
   Alternatively, if they do not co-share, they must occupy distinct possession slots ($g_a \neq g_b$) representing separate nights within that week's allocation $K_l$.

2. **External Exclusion Intrusion ($R_b \cap X_a \neq \empty$)**:
   If activity $b$ works inside the buffer, mirror, or interchange zone of activity $a$ without sharing working tracks ($R_a \cap R_b = \empty$), $b$ may **not** operate concurrently on the same night as $a$.
   However, activities $a$ and $b$ are permitted to run within the same calendar week $w$, provided they take place on **separate possession nights** (e.g. $a$ on night $t_1$, $b$ on night $t_2$), since night maintenance closes sectors only on the occupied night.

### 5.7. Weekly allocation

For group $h$, only $M_h$ distinct local access nights may be used.

Define

$$v_hwn \in \{0, 1\}$$

if and only if at least one activity belonging to $h$ uses local access night $n$:

$$x_{awn} \leq v_{hwn} \forall a: h(a) = h$$

Then,

$$\sum_{n} v_{hwn} \leq M_h$$

If we simply define 

$$n \in \{1, ..., M_h\}$$

this upper bound is largely encoded directly by the domain; $v$ is useful for explicit bookkeeping.

### 5.8. Workfronts

For each $h, w, n$:

$$\sum_{a: h(a) = h} x_{awn} \leq F_h$$

Thus, the theoretical maximum number of activity-accesses for group $h$ in one week is $M_hF_h$.

### 5.9. Early closure, late opening

Already captured by $e_{awn}$, where we enforce

$$e_{awn} \leq x_{awn}$$

and work delivered by one access is

$$x_{awn} + \frac{1}{2} e_{awn}$$

### 5.10. ECLO continuity window (Scenario C)

For each line $\lambda$, we define $H_\lambda$ as the first week of its ECLO window.

If activity $a$'s access affects line $\lambda$ and $e_{awn} = 1$, then

$$H_\lambda \leq w \leq H_\lambda + 1$$

Which forces l ECLO usage affecting a given line lies inside one contiguous window of at most two calendar weeks.

If a Live activity affects both lines and $e_{awn} = 1$, then the above inequality must satisfy for both $\lambda = ALP$ and $\lambda = BET$.

## 6. Completion and overrun

Let $D(w)$ be the calendar completion date corresponding to the end of planning week $w$.

For contract $c$, define $D_c^{plan}$ to be its `planned_completion_date`.

Activity overrun:

$$o_a = max(0, D(F_a)-D_{c(a)}^{plan})$$

measured in calendar days

For `RESULTS.csv` contract completion is

$$F_c = \max_{a:c(a)=c} F_a$$

with 

$$O_c = \max(0, D(F_c) - D_c^{plan})$$

The output reports contract copletion, while the validator's `priority_weighted_score` is summed per overruning activity.

## 7. Priority-weighted overrun score

Contract weight:

$$
B_c = \begin{cases}
  100 & \text{if } priority(c) = 1 \\
  10 & \text{if } priority(c) = 2 \\
  1 & \text{if } priority(c) = 3
\end{cases}
$$

Activity nudge:

$$
\rho_a = \begin{cases}
  0.3 & \text{if } activityPriority(a) = 1 \\
  0.2 & \text{if } activityPriority(a) = 2 \\
  0 & \text{if } activityPriority(a) = 3 \\
\end{cases}
$$

Effective activity delay weight:
$$\omega_a = B_{c(a)}(1 + \rho_a)$$

Therefore,

$$P = \sum_{a \in A} \omega_a o_a$$

## 8. Location-supply excess

Recall

$$U_lw = \sum_{g} u_{lwg}$$

Define

$$\mathscr{E}_{lw} = max(0, U_{lw} - K_l)$$

Total extra access nights:

$$X = \sum_{l, w} \mathscr{E}_{lw}$$

This matches the `extra_access_nights_total`: excess over nominal `LOCATION_SUPPLY`, summed across location-weeks.

## 9. ECLO total

$$E = \sum_{a, w, n} e_{awn}$$

## 10. Scenarios

### 10.1. Scenario A - Strict supply, flexible schedule

Additional hard constraints:

$$U_{lw} \leq K_l \forall l, w$$

and

$$e_{awn} = 0 \forall a, w, n$$

Objective:

$$\min Score_A = P$$

### 10.2. Scenario B - Strict schedule, flexible supply

Hard deadline:

$$D(F_a) \leq D_{c(a)}^{plan} \forall a$$

which also means $o_a = 0$.

Objective:

$$\min Score_B = 7X + 5E$$

### 10.3. Scenario C - Balanced/Elastic

Supply may exceed nominal capacity by at most one possession slot per location-week

$$U_{lw} \leq K_l + 1$$

or 

$$0 \leq \mathscr{E}_{lw} \leq 1$$

Rule 10's two-week ECLO window also applies

Objective:

$$\min Score_C = P + 7X + 5E$$

## 11. Complete optimization problem

> Minimise $Score_S$ such that
> 1. workload conservation
> 2. planned start
> 3. predecessor precedence
> 4. closures/buffers
> 5. possession capacity/legal mixes
> 6. co-sharing exemption
> 7. weekly allocations
> 8. workfronts
> 9. ECLO
> 10. ECLO window where applicable
> 
> and
> 
> scenario-specific supply/deadline constraints
> 
> and
>
> $x, e, y, z, u, v \in {0, 1}$
