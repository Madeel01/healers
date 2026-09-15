import React, {
  useRef,
  useState,
} from 'react';

import {
  Dimensions,
  FlatList,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SlideOne from './slides/SlideOne';
import SlideThree from './slides/SlideThree';
import SlideTwo from './slides/SlideTwo';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function OnboardingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const flatListRef = useRef(null);

  const scrollToStep = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setStep(index + 1);
  };

  const handleNext = () => {
    if (step < slides.length) {
      scrollToStep(step);
    } else {
      navigation.navigate("Welcome");
    }
  };

  const handleSkip = () => {
    navigation.navigate("Login");
  };

  const slides = [
    {
      id: "1",
      component: (
        <SlideOne
          onNext={handleNext}
          onSkip={handleSkip}
          step={step}
          totalSteps={3}
          onDotPress={scrollToStep}
        />
      ),
    },
    {
      id: "2",
      component: (
        <SlideTwo
          onNext={handleNext}
          onSkip={handleSkip}
          step={step}
          totalSteps={3}
          onDotPress={scrollToStep}
        />
      ),
    },
    {
      id: "3",
      component: (
        <SlideThree
          onNext={handleNext}
          onSkip={handleSkip}
          step={step}
          totalSteps={3}
          onDotPress={scrollToStep}
        />
      ),
    },
  ];

  const handleScroll = (event) => {
    const slideIndex = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
    );
    if (slideIndex + 1 !== step && slideIndex < slides.length) {
      setStep(slideIndex + 1);
    }
  };

  return (
    <View style={{ paddingTop: insets.top, flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
            {item.component}
          </View>
        )}
      />
    </View>
  );
}
