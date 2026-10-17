#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <vector>
#include "PositionBasedDynamics/XPBD.h"

struct Particle {
    Vector3r position;
    Vector3r previous;
    Real invMass;
};

struct Constraint {
    int a;
    int b;
    Real rest;
    Real lambda;
};

int main() {
    constexpr int W = 6;
    constexpr int H = 6;
    const Real spacing = 0.10;
    const Real dt = 1.0 / 60.0;
    const Real gravity = -9.81;
    const Real stiffness = 180000.0;
    const int frames = 120;
    const int iterations = 8;

    std::vector<Particle> particles;
    particles.reserve(W * H);
    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            Vector3r p((x - (W - 1) * 0.5) * spacing, 1.0 - y * spacing, 0.0);
            const bool pinned = (y == 0) && (x == 0 || x == W - 1);
            particles.push_back({p, p, pinned ? 0.0 : 1.0});
        }
    }

    auto index = [](int x, int y) { return y * W + x; };
    std::vector<Constraint> constraints;
    auto add = [&](int a, int b) {
        constraints.push_back({a, b, (particles[b].position - particles[a].position).norm(), 0.0});
    };
    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            if (x + 1 < W) add(index(x, y), index(x + 1, y));
            if (y + 1 < H) add(index(x, y), index(x, y + 1));
            if (x + 1 < W && y + 1 < H) {
                add(index(x, y), index(x + 1, y + 1));
                add(index(x + 1, y), index(x, y + 1));
            }
        }
    }

    const Vector3r leftPin = particles[index(0, 0)].position;
    const Vector3r rightPin = particles[index(W - 1, 0)].position;

    for (int frame = 0; frame < frames; ++frame) {
        for (auto &constraint : constraints) constraint.lambda = 0.0;
        for (auto &particle : particles) {
            if (particle.invMass <= 0.0) continue;
            Vector3r velocity = (particle.position - particle.previous) * 0.995;
            particle.previous = particle.position;
            particle.position += velocity;
            particle.position.y() += gravity * dt * dt;
        }

        for (int iteration = 0; iteration < iterations; ++iteration) {
            for (auto &constraint : constraints) {
                auto &a = particles[constraint.a];
                auto &b = particles[constraint.b];
                Vector3r corrA = Vector3r::Zero();
                Vector3r corrB = Vector3r::Zero();
                PBD::XPBD::solve_DistanceConstraint(
                    a.position, a.invMass,
                    b.position, b.invMass,
                    constraint.rest, stiffness, dt,
                    constraint.lambda, corrA, corrB);
                if (a.invMass > 0.0) a.position += corrA;
                if (b.invMass > 0.0) b.position += corrB;
            }
            particles[index(0, 0)].position = leftPin;
            particles[index(W - 1, 0)].position = rightPin;
        }
    }

    Real totalError = 0.0;
    Real maxError = 0.0;
    for (const auto &constraint : constraints) {
        Real distance = (particles[constraint.a].position - particles[constraint.b].position).norm();
        Real error = std::abs(distance - constraint.rest);
        totalError += error;
        maxError = std::max(maxError, error);
    }
    const Real averageError = totalError / constraints.size();
    const Real centerY = particles[index(W / 2, H / 2)].position.y();
    const Real bottomY = particles[index(W / 2, H - 1)].position.y();
    const bool finite = std::all_of(particles.begin(), particles.end(), [](const Particle &p) {
        return p.position.allFinite();
    });
    const bool pinsStable = (particles[index(0, 0)].position - leftPin).norm() < 1e-9 &&
                            (particles[index(W - 1, 0)].position - rightPin).norm() < 1e-9;
    const bool sagged = bottomY < 0.55;
    const bool passed = finite && pinsStable && sagged && averageError < 0.025 && maxError < 0.08;

    std::cout << std::fixed << std::setprecision(6)
              << "{\"backend\":\"PositionBasedDynamics-XPBD\","
              << "\"particles\":" << particles.size() << ','
              << "\"constraints\":" << constraints.size() << ','
              << "\"frames\":" << frames << ','
              << "\"centerY\":" << centerY << ','
              << "\"bottomY\":" << bottomY << ','
              << "\"averageEdgeError\":" << averageError << ','
              << "\"maxEdgeError\":" << maxError << ','
              << "\"finite\":" << (finite ? "true" : "false") << ','
              << "\"pinsStable\":" << (pinsStable ? "true" : "false") << ','
              << "\"passed\":" << (passed ? "true" : "false") << "}\n";
    return passed ? 0 : 1;
}
