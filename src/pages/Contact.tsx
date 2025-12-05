import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import heroImage from "@/assets/box-cricket-bg.jpg";
const Contact = () => {
  const {
    toast
  } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: ""
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent!",
      description: "We'll get back to you within 24 hours."
    });
    setFormData({
      name: "",
      email: "",
      phone: "",
      message: ""
    });
  };
  return <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 bg-cover bg-center -z-10" style={{
      backgroundImage: `url(${heroImage})`
    }}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
      </div>
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/80 to-accent/80 text-white py-20 mt-16">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-center">Contact Us</h1>
          <p className="text-xl text-center max-w-3xl mx-auto text-white/90">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Form */}
          <Card className="border-2 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <h2 className="text-3xl font-bold mb-6 text-card-foreground">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="John Doe" value={formData.name} onChange={e => setFormData({
                  ...formData,
                  name: e.target.value
                })} required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({
                  ...formData,
                  email: e.target.value
                })} required />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="+91 98765 43210" value={formData.phone} onChange={e => setFormData({
                  ...formData,
                  phone: e.target.value
                })} required />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" placeholder="Tell us how we can help you..." rows={5} value={formData.message} onChange={e => setFormData({
                  ...formData,
                  message: e.target.value
                })} required />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold mb-6 text-foreground">Get in Touch</h2>
            
            <Card className="border-2 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-card-foreground">Address</h3>
                    <p className="text-muted-foreground">Stumps Drive In ,Beside Duvvada Bridge
Rajeeve Nagar road, City 560001
Visakhapattnam, India<br />
                      Sports Complex, City 560001<br />
                      Karnataka, India
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-card-foreground">Phone</h3>
                    <p className="text-muted-foreground">
                      +91 98765 43210<br />
                      +91 98765 43211
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-card-foreground">Email</h3>
                    <p className="text-muted-foreground">
                      info@boxcricket.com<br />
                      support@boxcricket.com
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 bg-card/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-card-foreground">Business Hours</h3>
                    <p className="text-muted-foreground">
                      Monday - Friday: 6 AM - 11 PM<br />
                      Saturday - Sunday: Open 24 Hours
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-20 bg-secondary/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12 text-foreground">Find Us</h2>
          <div className="max-w-5xl mx-auto">
            <Card className="overflow-hidden bg-card/80 backdrop-blur-sm">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d950.6!2d83.1578934!3d17.7006083!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a396f8a3b96c05d%3A0x353d26024494d2e6!2sShake%20Aadistha!5e0!3m2!1sen!2sin!4v1701782400000!5m2!1sen!2sin"
                width="100%"
                height="384"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="rounded-lg"
              />
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card/80 backdrop-blur-sm border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>;
};
export default Contact;