#include <emscripten/bind.h>
#include <emscripten/emscripten.h>
#include <vector>
#include <cmath>
#include <memory>

using namespace emscripten;

struct Vec3 {
    float x, y, z;
};

struct Node {
    Vec3 position;
    Vec3 velocity;
    float charge;
};

struct Link {
    int source;
    int target;
};

class ForceSimulation {
private:
    std::vector<Node> nodes;
    std::vector<Link> links;
    std::vector<float> distances;
    std::vector<float> strengths;
    float maxDistance;
    float velocityDecay;

public:
    ForceSimulation(float maxDist = 100.0f, float velDecay = 0.1f)
        : maxDistance(maxDist), velocityDecay(velDecay) {}

    void setNodes(const std::vector<Node>& newNodes) {
        nodes = newNodes;
    }

    void setLinks(const std::vector<Link>& newLinks) {
        links = newLinks;
    }

    void setDistances(const std::vector<float>& newDistances) {
        distances = newDistances;
    }

    void setStrengths(const std::vector<float>& newStrengths) {
        strengths = newStrengths;
    }

    const std::vector<Node>& getNodes() const {
        return nodes;
    }

    void step() {
        // Calcul des forces de répulsion
        for (size_t i = 0; i < nodes.size(); i++) {
            Vec3 force = {0, 0, 0};
            for (size_t j = 0; j < nodes.size(); j++) {
                if (i != j) {
                    float dx = nodes[j].position.x - nodes[i].position.x;
                    float dy = nodes[j].position.y - nodes[i].position.y;
                    float dz = nodes[j].position.z - nodes[i].position.z;
                    
                    float distance = sqrt(dx*dx + dy*dy + dz*dz);
                    if (distance > 0 && distance < maxDistance) {
                        float repulsion = nodes[i].charge * nodes[j].charge / (distance * distance);
                        force.x += dx/distance * repulsion;
                        force.y += dy/distance * repulsion;
                        force.z += dz/distance * repulsion;
                    }
                }
            }
            nodes[i].velocity.x += force.x;
            nodes[i].velocity.y += force.y;
            nodes[i].velocity.z += force.z;
        }

        // Calcul des forces des liens
        for (size_t i = 0; i < links.size(); i++) {
            int source = links[i].source;
            int target = links[i].target;
            float targetDistance = distances[i];
            float strength = strengths[i];
            
            float dx = nodes[target].position.x - nodes[source].position.x;
            float dy = nodes[target].position.y - nodes[source].position.y;
            float dz = nodes[target].position.z - nodes[source].position.z;
            
            float distance = sqrt(dx*dx + dy*dy + dz*dz);
            if (distance > 0) {
                float force = strength * (distance - targetDistance);
                float fx = dx/distance * force;
                float fy = dy/distance * force;
                float fz = dz/distance * force;
                
                nodes[source].velocity.x += fx;
                nodes[source].velocity.y += fy;
                nodes[source].velocity.z += fz;
                
                nodes[target].velocity.x -= fx;
                nodes[target].velocity.y -= fy;
                nodes[target].velocity.z -= fz;
            }
        }

        // Mise à jour des positions
        for (auto& node : nodes) {
            node.position.x += node.velocity.x;
            node.position.y += node.velocity.y;
            node.position.z += node.velocity.z;
            
            node.velocity.x *= velocityDecay;
            node.velocity.y *= velocityDecay;
            node.velocity.z *= velocityDecay;
        }
    }
};

// Bindings pour l'interface avec JavaScript
EMSCRIPTEN_BINDINGS(force_calculations) {
    value_object<Vec3>("Vec3")
        .field("x", &Vec3::x)
        .field("y", &Vec3::y)
        .field("z", &Vec3::z);
        
    value_object<Node>("Node")
        .field("position", &Node::position)
        .field("velocity", &Node::velocity)
        .field("charge", &Node::charge);

    value_object<Link>("Link")
        .field("source", &Link::source)
        .field("target", &Link::target);
        
    register_vector<Node>("NodeVector");
    register_vector<Link>("LinkVector");
    register_vector<float>("FloatVector");

    class_<ForceSimulation>("ForceSimulation")
        .constructor<float, float>()
        .function("setNodes", &ForceSimulation::setNodes)
        .function("setLinks", &ForceSimulation::setLinks)
        .function("setDistances", &ForceSimulation::setDistances)
        .function("setStrengths", &ForceSimulation::setStrengths)
        .function("getNodes", &ForceSimulation::getNodes)
        .function("step", &ForceSimulation::step);
} 