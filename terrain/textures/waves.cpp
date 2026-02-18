#include <iostream>
#include <vector>
#include <cmath>
#include <string>

struct Color {
    double r, g, b;
    
    Color(double r = 0, double g = 0, double b = 0) : r(r), g(g), b(b) {}
};

class Vector {
public:
    double x, y;
    
    Vector(double x, double y) : x(x), y(y) {}
    
    double return_vector() const {
        return x + y;
    }
};

using ColorMatrix = std::vector<std::vector<Color>>;

ColorMatrix wavesRender(int x, int y, double f, double po, const std::string& direction) {
    ColorMatrix colorMatrix(y, std::vector<Color>(x));
    // f means frequency and po means phase offset
    
    for (int j = 0; j < y; j++) {
        for (int i = 0; i < x; i++) {
            double c;
            if (direction == "x") {
                c = (std::sin(f * i + po) + 1) * 255.0 / 2.0;
            } else if (direction == "y") {
                c = (std::sin(f * j + po) + 1) * 255.0 / 2.0;
            } else {
                c = 0;
            }
            colorMatrix[j][i] = Color(c, c, c);
        }
    }
    return colorMatrix;
}

ColorMatrix circleRender(int x, int y, double f, double poX, double poY) {
    double k = poX;
    double m = poY;
    ColorMatrix colorMatrix(y, std::vector<Color>(x));
    
    for (int j = 0; j < y; j++) {
        for (int i = 0; i < x; i++) {
            double radius = std::sqrt(std::pow(i - m, 2) + std::pow(j - k, 2));
            // first part is damping factor
            double c = (1.0 / (0.2 * (radius + 5))) * std::sin(f * radius + 1) * 255.0 / 2.0;
            colorMatrix[j][i] = Color(c, c, c);
        }
    }
    return colorMatrix;
}

ColorMatrix centralRender(const std::string& renderCase, int x, int y, double f, 
                          double poX, double poY, const std::string& direction) {
    if (renderCase == "circle") {
        return circleRender(x, y, f, poX, poY);
    } else {
        return wavesRender(x, y, f, poX, direction);
    }
}

// Example usage / test
int main() {
    // Test wavesRender
    ColorMatrix waves = wavesRender(10, 10, 0.5, 0.0, "x");
    std::cout << "Waves render (10x10, direction=x):" << std::endl;
    for (int j = 0; j < 10; j++) {
        for (int i = 0; i < 10; i++) {
            std::cout << static_cast<int>(waves[j][i].r) << " ";
        }
        std::cout << std::endl;
    }
    
    std::cout << "\nCircle render (10x10, center at 5,5):" << std::endl;
    ColorMatrix circle = circleRender(10, 10, 0.5, 5.0, 5.0);
    for (int j = 0; j < 10; j++) {
        for (int i = 0; i < 10; i++) {
            std::cout << static_cast<int>(circle[j][i].r) << " ";
        }
        std::cout << std::endl;
    }
    
    return 0;
}
