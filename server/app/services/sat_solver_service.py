from ortools.sat.python import cp_model

class SatSolverService:
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()

    def add_variable(self, name, lb, ub):
        return self.model.NewIntVar(lb, ub, name)

    def add_constraint(self, constraint):
        self.model.Add(constraint)

    def solve(self):
        status = self.solver.Solve(self.model)
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            return True
        else:
            return False

    def get_value(self, variable):
        return self.solver.Value(variable)