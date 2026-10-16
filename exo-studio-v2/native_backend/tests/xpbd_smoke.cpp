#include <cmath>
#include <iomanip>
#include <iostream>
#include "PositionBasedDynamics/XPBD.h"

int main() {
    Vector3r p0(0.0f, 0.0f, 0.0f);
    Vector3r p1(2.0f, 0.0f, 0.0f);
    const Real invMass0 = 1.0f;
    const Real invMass1 = 1.0f;
    const Real restLength = 1.0f;
    const Real stiffness = 250000.0f;
    const Real dt = 1.0f / 60.0f;
    Real lambda = 0.0f;

    const auto initial = (p1 - p0).norm();
    for (int iteration = 0; iteration < 10; ++iteration) {
        Vector3r corr0 = Vector3r::Zero();
        Vector3r corr1 = Vector3r::Zero();
        if (!PBD::XPBD::solve_DistanceConstraint(
            p0, invMass0, p1, invMass1, restLength, stiffness, dt, lambda, corr0, corr1)) {
            std::cerr << "XPBD solver returned false\n";
            return 2;
        }
        p0 += corr0;
        p1 += corr1;
    }
    const auto finalDistance = (p1 - p0).norm();
    const auto finalError = std::abs(finalDistance - restLength);
    const bool passed = std::isfinite(finalDistance) && finalError < 0.01f && finalDistance < initial;

    std::cout << std::fixed << std::setprecision(6)
              << "{\"backend\":\"PositionBasedDynamics-XPBD\","
              << "\"initialDistance\":" << initial << ','
              << "\"restLength\":" << restLength << ','
              << "\"finalDistance\":" << finalDistance << ','
              << "\"finalError\":" << finalError << ','
              << "\"passed\":" << (passed ? "true" : "false") << "}\n";
    return passed ? 0 : 1;
}
