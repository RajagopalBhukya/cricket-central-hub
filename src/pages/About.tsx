import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Users, Award, Heart } from "lucide-react";
import heroImage from "@/assets/box-cricket-bg.jpg";

const About = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <div
        className="fixed inset-0 bg-cover bg-center -z-10"
        style={{
          backgroundImage: `url(${heroImage})`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
      </div>
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/80 to-accent/80 text-white py-20 mt-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-center">About Us</h1>
          <p className="text-xl text-center max-w-3xl mx-auto text-white/90">
            We're passionate about bringing the joy of cricket to everyone through easy, accessible box cricket ground bookings.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <Card className="border-2 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-card-foreground">Our Mission</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                To make box cricket accessible to everyone by providing premium grounds, seamless booking experiences, and fostering a vibrant cricket community.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                <Award className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-card-foreground">Our Vision</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                To become the leading platform for box cricket bookings, creating spaces where passion meets play and communities thrive through sports.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-secondary/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-foreground">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-foreground">Community First</h3>
              <p className="text-muted-foreground">
                We believe in building strong cricket communities where everyone feels welcome.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-foreground">Passion for Cricket</h3>
              <p className="text-muted-foreground">
                Cricket is more than a game; it's a passion that brings people together.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-foreground">Excellence</h3>
              <p className="text-muted-foreground">
                We strive for excellence in every aspect of our service and facilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-8 text-center text-foreground">Our Story</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              Founded in 2024, Box Cricket was born from a simple idea: make it easier for cricket lovers to find and book quality playing grounds. What started as a small initiative has grown into a thriving platform serving thousands of players.
            </p>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              We understand the challenges of organizing a cricket match - from finding available grounds to coordinating with teammates. That's why we've built a platform that takes the hassle out of booking, so you can focus on what matters most: playing cricket.
            </p>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Today, we operate multiple premium grounds across the city, each maintained to the highest standards. Our commitment to quality, convenience, and community has made us the preferred choice for cricket enthusiasts everywhere.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-primary/90 text-primary-foreground backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold mb-2">10+</div>
              <div className="text-lg opacity-90">Grounds</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">5000+</div>
              <div className="text-lg opacity-90">Happy Players</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">15000+</div>
              <div className="text-lg opacity-90">Bookings</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">24/7</div>
              <div className="text-lg opacity-90">Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/80 backdrop-blur-sm border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default About;
